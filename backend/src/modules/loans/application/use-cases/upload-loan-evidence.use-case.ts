import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service.js';
import { instantToDate } from '../../../../shared/infrastructure/prisma/instant-to-date.js';
import { SupabaseStorageService } from '../../../../shared/infrastructure/storage/supabase-storage.service.js';
import { LoanRepository } from '../../domain/repositories/loan.repository.js';
import type { LoanEvidenceType } from '../../presentation/dto/upload-loan-evidence.dto.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_FILES = 10;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Comprobación de cabecera/estructura básica, no decodificación exhaustiva.
function matchesImage(buffer: Buffer, mime: string): boolean {
  if (mime === 'image/png') {
    return (
      buffer.length >= 33 &&
      buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) &&
      buffer.readUInt32BE(8) === 13 &&
      buffer.toString('ascii', 12, 16) === 'IHDR' &&
      buffer.readUInt32BE(16) > 0 &&
      buffer.readUInt32BE(20) > 0
    );
  }
  if (mime === 'image/jpeg') {
    return (
      buffer.length >= 4 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff &&
      buffer.subarray(-2).equals(Buffer.from([0xff, 0xd9]))
    );
  }
  return (
    mime === 'image/webp' &&
    buffer.length >= 20 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.readUInt32LE(4) === buffer.length - 8 &&
    buffer.toString('ascii', 8, 12) === 'WEBP' &&
    ['VP8 ', 'VP8L', 'VP8X'].includes(buffer.toString('ascii', 12, 16)) &&
    buffer.readUInt32LE(16) > 0 &&
    buffer.readUInt32LE(16) <= buffer.length - 20
  );
}

@Injectable()
export class UploadLoanEvidenceUseCase {
  private readonly logger = new Logger(UploadLoanEvidenceUseCase.name);
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
    if (input.files.length > MAX_FILES) {
      throw new BadRequestException('Puede adjuntar como máximo 10 imágenes.');
    }
    for (const file of input.files) {
      if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        throw new BadRequestException(
          'Solo se permiten imágenes JPEG, PNG o WebP.',
        );
      }
      if (!Buffer.isBuffer(file.buffer) || !file.buffer.length) {
        throw new BadRequestException('La imagen no puede estar vacía.');
      }
      if (file.buffer.length > MAX_FILE_SIZE) {
        throw new BadRequestException(
          'Cada imagen debe pesar como máximo 5 MB.',
        );
      }
      if (
        file.size !== file.buffer.length ||
        !matchesImage(file.buffer, file.mimetype)
      ) {
        throw new BadRequestException(
          'El contenido de la imagen no coincide con su formato o tamaño.',
        );
      }
    }

    const prepared = input.files.map((file) => {
      const id = randomUUID();
      const extension =
        file.mimetype === 'image/jpeg' ? 'jpg' : file.mimetype.split('/')[1];
      return {
        file,
        id,
        path: `loans/${input.loanId}/${input.type.toLowerCase()}/${id}.${extension}`,
        hash: createHash('sha256').update(file.buffer).digest('hex'),
      };
    });
    const uploadedPaths: string[] = [];
    const urls = new Map<string, string>();
    let persisted = false;
    try {
      for (const { file, path } of prepared) {
        await this.storage.upload(path, file);
        uploadedPaths.push(path);
        urls.set(path, await this.storage.createSignedUrl(path));
      }
      const rows = await this.prisma.client.transaction(async (tx) => {
        const inserted = [];
        for (const { file, id, path, hash } of prepared) {
          const result = await tx.query(
            this.prisma.sql.public.evidencias_prestamo
              .insert([
                {
                  id,
                  prestamoId: input.loanId,
                  tipo: input.type,
                  ruta: path,
                  nombreOriginal: file.originalname.slice(0, 255),
                  mimeType: file.mimetype,
                  tamanoBytes: file.buffer.length,
                  hash,
                  descripcion: input.description?.trim() || null,
                  cargadoPorCuentaId: input.accountId,
                },
              ])
              .returning(
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
              )
              .build(),
          );
          const row = result[0];
          if (!row) throw new Error('No se pudo persistir la evidencia.');
          inserted.push(row);
        }
        return inserted;
      });
      persisted = true;
      return await Promise.all(
        rows.map((row) => this.map(row, urls.get(row.ruta))),
      );
    } catch (error) {
      if (!persisted)
        for (const path of uploadedPaths) {
          try {
            await this.storage.remove(path);
          } catch {
            this.logger.error('loan-evidence: compensation-failed');
          }
        }
      this.logger.error(
        persisted
          ? 'loan-evidence: response-failed-after-persistence'
          : 'loan-evidence: upload-or-persistence-failed',
      );
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(
        'No se pudo guardar la evidencia.',
      );
    }
  }

  async list(loanId: string) {
    const loan = await this.loans.findById(loanId);
    if (!loan) throw new NotFoundException('Préstamo no encontrado.');
    const rows = await this.prisma.client.runtime().query(
      this.prisma.sql.public.evidencias_prestamo
        .select(
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
        )
        .where((row, fns) => fns.eq(row.prestamoId, loanId))
        .build(),
    );
    return Promise.all(rows.map((row: any) => this.map(row)));
  }

  private async map(row: any, signedUrl?: string) {
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
      url: signedUrl ?? (await this.storage.createSignedUrl(row.ruta)),
    };
  }
}
