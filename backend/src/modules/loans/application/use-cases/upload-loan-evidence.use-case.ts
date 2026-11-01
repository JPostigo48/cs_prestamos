import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service.js';
import { instantToDate } from '../../../../shared/infrastructure/prisma/instant-to-date.js';
import { SupabaseStorageService } from '../../../../shared/infrastructure/storage/supabase-storage.service.js';
import { LoanRepository } from '../../domain/repositories/loan.repository.js';
import type { LoanEvidenceType } from '../../presentation/dto/upload-loan-evidence.dto.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Injectable()
export class UploadLoanEvidenceUseCase {
  constructor(
    private readonly loans: LoanRepository,
    private readonly prisma: PrismaService,
    private readonly storage: SupabaseStorageService,
  ) {}

  async execute(input: {
    loanId: string;
    type: LoanEvidenceType;
    description?: string;
    files: Express.Multer.File[];
    accountId: string;
  }) {
    const loan = await this.loans.findById(input.loanId);
    if (!loan) throw new NotFoundException('Préstamo no encontrado.');
    if (!input.files?.length) {
      throw new BadRequestException('Debe adjuntar al menos una imagen.');
    }
    for (const file of input.files) {
      if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        throw new BadRequestException(
          'Solo se permiten imágenes JPEG, PNG o WebP.',
        );
      }
      if (file.size > MAX_FILE_SIZE) {
        throw new BadRequestException('Cada imagen debe pesar como máximo 5 MB.');
      }
    }

    const runtime = this.prisma.client.runtime();
    const uploadedPaths: string[] = [];
    try {
      const results = [];
      for (const file of input.files) {
        const evidenceId = randomUUID();
        const extension = file.mimetype === 'image/jpeg'
          ? 'jpg'
          : file.mimetype.split('/')[1];
        const path = `loans/${input.loanId}/${input.type.toLowerCase()}/${evidenceId}.${extension}`;
        await this.storage.upload(path, file);
        uploadedPaths.push(path);
        const hash = createHash('sha256').update(file.buffer).digest('hex');
        const rows = await runtime.query(
          this.prisma.sql.public.evidencias_prestamo.insert([{
            id: evidenceId,
            prestamoId: input.loanId,
            tipo: input.type,
            ruta: path,
            nombreOriginal: file.originalname.slice(0, 255),
            mimeType: file.mimetype,
            tamanoBytes: file.size,
            hash,
            descripcion: input.description?.trim() || null,
            cargadoPorCuentaId: input.accountId,
          }]).returning(
            'id',
            'prestamoId',
            'tipo',
            'ruta',
            'nombreOriginal',
            'mimeType',
            'tamanoBytes',
            'hash',
            'descripcion',
            'cargadoPorCuentaId',
            'createdAt',
          ).build(),
        );
        const row = rows[0];
        if (!row) throw new Error('No se pudo persistir la evidencia.');
        results.push(await this.map(row));
      }
      return results;
    } catch (error) {
      for (const path of uploadedPaths) {
        try {
          await this.storage.remove(path);
        } catch {
          // La excepción original contiene el fallo de la operación principal.
        }
      }
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'No se pudo guardar la evidencia.',
      );
    }
  }

  async list(loanId: string) {
    const loan = await this.loans.findById(loanId);
    if (!loan) throw new NotFoundException('Préstamo no encontrado.');
    const rows = await this.prisma.client.runtime().query(
      this.prisma.sql.public.evidencias_prestamo.select(
        'id',
        'prestamoId',
        'tipo',
        'ruta',
        'nombreOriginal',
        'mimeType',
        'tamanoBytes',
        'hash',
        'descripcion',
        'cargadoPorCuentaId',
        'createdAt',
      ).where((row, fns) => fns.eq(row.prestamoId, loanId)).build(),
    );
    return Promise.all(rows.map((row: any) => this.map(row)));
  }

  private async map(row: any) {
    return {
      id: row.id,
      loanId: row.prestamoId,
      type: row.tipo,
      originalName: row.nombreOriginal,
      mimeType: row.mimeType,
      sizeBytes: row.tamanoBytes,
      hash: row.hash,
      description: row.descripcion,
      uploadedByAccountId: row.cargadoPorCuentaId,
      createdAt: instantToDate(row.createdAt),
      url: await this.storage.createSignedUrl(row.ruta),
    };
  }
}
