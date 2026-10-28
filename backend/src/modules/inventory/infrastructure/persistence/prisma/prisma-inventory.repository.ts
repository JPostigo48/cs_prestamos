import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Temporal } from 'temporal-polyfill';
import type { AuditActor } from '../../../../../shared/application/audit-actor.js';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service.js';
import type {
  InventoryCopyStateManaged,
  InventoryCopyStatus,
} from '../../../domain/entities/inventory.types.js';
import { InventoryRepository } from '../../../domain/repositories/inventory.repository.js';

type QueryRuntime = Pick<
  ReturnType<PrismaService['client']['runtime']>,
  'query'
>;

@Injectable()
export class PrismaInventoryRepository extends InventoryRepository {
  private transactionRuntime?: QueryRuntime;
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  private runtime() {
    return this.transactionRuntime ?? this.prisma.client.runtime();
  }

  async audited<T>(
    actor: AuditActor,
    action: string,
    work: (repository: InventoryRepository) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.client.transaction(async (tx) => {
        const scoped = new PrismaInventoryRepository(this.prisma);
        scoped.transactionRuntime = tx;
        const result = await work(scoped);
        await tx.query(
          this.prisma.sql.public.auditorias_usuario
            .insert([
              {
                usuarioId: actor.userId,
                accion: action,
                datosNuevos: JSON.stringify({ actor, result }),
              },
            ])
            .returning('id')
            .build(),
        );
        return result;
      });
    } catch (error) {
      const code =
        (error as { code?: string; cause?: { code?: string } })?.cause?.code ??
        (error as { code?: string })?.code;
      if (code === '23503' || code === '23505')
        throw new ConflictException(
          'La operación entra en conflicto con datos relacionados.',
        );
      throw error;
    }
  }

  private async copyTransaction<T>(
    work: (runtime: QueryRuntime) => Promise<T>,
  ): Promise<T> {
    return this.transactionRuntime
      ? work(this.transactionRuntime)
      : this.prisma.client.transaction(work);
  }

  private async lockCopy(runtime: QueryRuntime, copyId: string) {
    const rows = await runtime.query(
      this.prisma.sql.public.ejemplares
        .update({ updatedAt: Temporal.Now.instant() })
        .where((row, fns) => fns.eq(row.id, copyId))
        .returning('id', 'recursoId', 'codigoInventario', 'estado')
        .build(),
    );
    if (!rows[0]) throw new NotFoundException('Ejemplar no encontrado.');
    return rows[0];
  }

  async updateManagedCopy(
    copyId: string,
    data: { codigoInventario?: string; estado?: InventoryCopyStateManaged },
  ) {
    return this.copyTransaction(async (runtime) => {
      const copy = await this.lockCopy(runtime, copyId);
      if (copy.estado === 'PRESTADO' || copy.estado === 'RESERVADO')
        throw new ConflictException(
          'El ejemplar tiene una operación en curso.',
        );
      const loans = await runtime.query(
        this.prisma.sql.public.prestamos
          .select('id')
          .where((row, fns) => fns.eq(row.ejemplarId, copyId))
          .where((row, fns) => fns.ne(row.estado, 'FINALIZADO'))
          .limit(1)
          .build(),
      );
      const reservations = await runtime.query(
        this.prisma.sql.public.reservas
          .select('id')
          .where((row, fns) => fns.eq(row.ejemplarId, copyId))
          .where((row, fns) => fns.eq(row.estado, 'CONFIRMADA'))
          .limit(1)
          .build(),
      );
      if (loans[0] || reservations[0])
        throw new ConflictException(
          'El ejemplar tiene reservas o préstamos pendientes.',
        );
      const rows = await runtime.query(
        this.prisma.sql.public.ejemplares
          .update(data)
          .where((row, fns) => fns.eq(row.id, copyId))
          .returning('id', 'recursoId', 'codigoInventario', 'estado')
          .build(),
      );
      return rows[0];
    });
  }

  async createCategory(data: {
    nombre: string;
    tiempoMaximoPrestamoDias: number;
    tiempoMaximoPrestamoHoras?: number;
  }) {
    const query = this.prisma.sql.public.categorias_recurso
      .insert([
        {
          nombre: data.nombre,
          tiempoMaximoPrestamoDias: data.tiempoMaximoPrestamoDias,
          tiempoMaximoPrestamoHoras:
            data.tiempoMaximoPrestamoHoras ??
            data.tiempoMaximoPrestamoDias * 24,
        },
      ])
      .returning(
        'id',
        'nombre',
        'tiempoMaximoPrestamoDias',
        'tiempoMaximoPrestamoHoras',
        'createdAt',
        'updatedAt',
      )
      .build();
    const rows = await this.runtime().query(query);
    return rows[0] ?? null;
  }

  async findAllCategories() {
    const query = this.prisma.sql.public.categorias_recurso
      .select(
        'id',
        'nombre',
        'tiempoMaximoPrestamoDias',
        'tiempoMaximoPrestamoHoras',
      )
      .build();
    return await this.runtime().query(query);
  }

  async findCategoryById(categoryId: string) {
    const query = this.prisma.sql.public.categorias_recurso
      .select(
        'id',
        'nombre',
        'tiempoMaximoPrestamoDias',
        'tiempoMaximoPrestamoHoras',
        'createdAt',
        'updatedAt',
      )
      .where((row, fns) => fns.eq(row.id, categoryId))
      .limit(1)
      .build();
    const rows = await this.runtime().query(query);
    return rows[0] ?? null;
  }

  async updateCategory(
    categoryId: string,
    data: Partial<{
      nombre: string;
      tiempoMaximoPrestamoDias: number;
      tiempoMaximoPrestamoHoras: number;
    }>,
  ) {
    const query = this.prisma.sql.public.categorias_recurso
      .update({
        ...(data.nombre !== undefined ? { nombre: data.nombre } : {}),
        ...(data.tiempoMaximoPrestamoDias !== undefined
          ? { tiempoMaximoPrestamoDias: data.tiempoMaximoPrestamoDias }
          : {}),
        ...(data.tiempoMaximoPrestamoHoras !== undefined
          ? { tiempoMaximoPrestamoHoras: data.tiempoMaximoPrestamoHoras }
          : {}),
      })
      .where((row, fns) => fns.eq(row.id, categoryId))
      .returning(
        'id',
        'nombre',
        'tiempoMaximoPrestamoDias',
        'createdAt',
        'updatedAt',
        'tiempoMaximoPrestamoHoras',
      )
      .build();
    const rows = await this.runtime().query(query);
    return rows[0] ?? null;
  }

  async deleteCategory(categoryId: string) {
    const query = this.prisma.sql.public.categorias_recurso
      .delete()
      .where((row, fns) => fns.eq(row.id, categoryId))
      .returning('id')
      .build();
    const rows = await this.runtime().query(query);
    return rows.length;
  }

  async countResourcesByCategory(categoryId: string): Promise<number> {
    const query = this.prisma.sql.public.recursos
      .select('id')
      .where((row, fns) => fns.eq(row.categoriaId, categoryId))
      .build();
    const rows = await this.runtime().query(query);
    return rows.length;
  }

  async createResource(data: {
    categoriaId: string;
    nombre: string;
    descripcion?: string | null;
  }) {
    const query = this.prisma.sql.public.recursos
      .insert([
        {
          categoriaId: data.categoriaId,
          nombre: data.nombre,
          descripcion: data.descripcion ?? null,
        },
      ])
      .returning(
        'id',
        'categoriaId',
        'nombre',
        'descripcion',
        'createdAt',
        'updatedAt',
      )
      .build();
    const rows = await this.runtime().query(query);
    return rows[0] ?? null;
  }

  async findAllResources(filters?: {
    categoryId?: string;
    available?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    let base = this.prisma.sql.public.recursos.select(
      'id',
      'categoriaId',
      'nombre',
      'descripcion',
      'createdAt',
      'updatedAt',
    );

    if (filters?.categoryId) {
      base = base.where((row, fns) =>
        fns.eq(row.categoriaId, filters.categoryId!),
      );
    }

    if (filters?.search) {
      base = base.where((row, fns) =>
        fns.ilike(row.nombre, `%${filters.search!}%`),
      );
    }

    if (filters?.limit !== undefined) {
      base = base.limit(filters.limit);
    }
    if (filters?.offset !== undefined) {
      base = base.offset(filters.offset);
    }

    const query = base.build();
    return await this.runtime().query(query);
  }

  async countResources(filters?: { categoryId?: string; search?: string }) {
    let base = this.prisma.sql.public.recursos.select('id');
    if (filters?.categoryId) {
      base = base.where((row, fns) =>
        fns.eq(row.categoriaId, filters.categoryId!),
      );
    }
    if (filters?.search) {
      base = base.where((row, fns) =>
        fns.ilike(row.nombre, `%${filters.search!}%`),
      );
    }
    const rows = await this.runtime().query(base.build());
    return rows.length;
  }

  async findResourceById(resourceId: string) {
    const query = this.prisma.sql.public.recursos
      .select(
        'id',
        'categoriaId',
        'nombre',
        'descripcion',
        'createdAt',
        'updatedAt',
      )
      .where((row, fns) => fns.eq(row.id, resourceId))
      .limit(1)
      .build();
    const rows = await this.runtime().query(query);
    return rows[0] ?? null;
  }

  async updateResource(
    resourceId: string,
    data: Partial<{
      categoriaId: string;
      nombre: string;
      descripcion?: string | null;
    }>,
  ) {
    const query = this.prisma.sql.public.recursos
      .update({
        ...(data.categoriaId !== undefined
          ? { categoriaId: data.categoriaId }
          : {}),
        ...(data.nombre !== undefined ? { nombre: data.nombre } : {}),
        ...(data.descripcion !== undefined
          ? { descripcion: data.descripcion ?? null }
          : {}),
      })
      .where((row, fns) => fns.eq(row.id, resourceId))
      .returning(
        'id',
        'categoriaId',
        'nombre',
        'descripcion',
        'createdAt',
        'updatedAt',
      )
      .build();
    const rows = await this.runtime().query(query);
    return rows[0] ?? null;
  }

  async deleteResource(resourceId: string) {
    const query = this.prisma.sql.public.recursos
      .delete()
      .where((row, fns) => fns.eq(row.id, resourceId))
      .returning('id')
      .build();
    const rows = await this.runtime().query(query);
    return rows.length;
  }

  async countCopiesByResource(resourceId: string): Promise<number> {
    const query = this.prisma.sql.public.ejemplares
      .select('id')
      .where((row, fns) => fns.eq(row.recursoId, resourceId))
      .build();
    const rows = await this.runtime().query(query);
    return rows.length;
  }

  async countAvailableCopiesByResource(resourceId: string): Promise<number> {
    const query = this.prisma.sql.public.ejemplares
      .select('id')
      .where((row, fns) => fns.eq(row.recursoId, resourceId))
      .where((row, fns) => fns.eq(row.estado, 'DISPONIBLE'))
      .build();
    const rows = await this.runtime().query(query);
    return rows.length;
  }

  async countCopiesByResourceAndState(
    resourceId: string,
    estado: InventoryCopyStatus,
  ): Promise<number> {
    const query = this.prisma.sql.public.ejemplares
      .select('id')
      .where((row, fns) => fns.eq(row.recursoId, resourceId))
      .where((row, fns) => fns.eq(row.estado, estado))
      .build();
    const rows = await this.runtime().query(query);
    return rows.length;
  }

  async createCopy(data: {
    recursoId: string;
    codigoInventario: string;
    estado?: InventoryCopyStatus;
  }) {
    const estado: InventoryCopyStatus = (data.estado ??
      'DISPONIBLE') as InventoryCopyStatus;
    const query = this.prisma.sql.public.ejemplares
      .insert([
        {
          recursoId: data.recursoId,
          codigoInventario: data.codigoInventario,
          estado,
        },
      ])
      .returning(
        'id',
        'recursoId',
        'codigoInventario',
        'estado',
        'createdAt',
        'updatedAt',
      )
      .build();
    const rows = await this.runtime().query(query);
    return rows[0] ?? null;
  }

  async findCopiesByResource(resourceId: string) {
    const query = this.prisma.sql.public.ejemplares
      .select(
        'id',
        'recursoId',
        'codigoInventario',
        'estado',
        'createdAt',
        'updatedAt',
      )
      .where((row, fns) => fns.eq(row.recursoId, resourceId))
      .build();
    return await this.runtime().query(query);
  }

  async findCopyById(copyId: string) {
    const query = this.prisma.sql.public.ejemplares
      .select(
        'id',
        'recursoId',
        'codigoInventario',
        'estado',
        'createdAt',
        'updatedAt',
      )
      .where((row, fns) => fns.eq(row.id, copyId))
      .limit(1)
      .build();
    const rows = await this.runtime().query(query);
    return rows[0] ?? null;
  }

  async deleteCopy(copyId: string) {
    // Nunca se borra físicamente: observaciones, préstamos y reservas se conservan.
    await this.updateManagedCopy(copyId, { estado: 'NO_DISPONIBLE' });
    return 1;
  }

  async updateCopyState(copyId: string, estado: InventoryCopyStateManaged) {
    const nextState: InventoryCopyStateManaged =
      estado as InventoryCopyStateManaged;
    const query = this.prisma.sql.public.ejemplares
      .update({ estado: nextState })
      .where((row, fns) => fns.eq(row.id, copyId))
      .returning(
        'id',
        'recursoId',
        'codigoInventario',
        'estado',
        'createdAt',
        'updatedAt',
      )
      .build();
    const rows = await this.runtime().query(query);
    return rows[0] ?? null;
  }

  async markCopyAsLoaned(copyId: string) {
    const query = this.prisma.sql.public.ejemplares
      .update({ estado: 'PRESTADO' })
      .where((row, fns) => fns.eq(row.id, copyId))
      .returning(
        'id',
        'recursoId',
        'codigoInventario',
        'estado',
        'createdAt',
        'updatedAt',
      )
      .build();
    const rows = await this.runtime().query(query);
    return rows[0] ?? null;
  }

  async createObservation(data: { ejemplarId: string; descripcion: string }) {
    const query = this.prisma.sql.public.observaciones_ejemplar
      .insert([{ ejemplarId: data.ejemplarId, descripcion: data.descripcion }])
      .returning('id', 'ejemplarId', 'descripcion', 'fecha', 'createdAt')
      .build();
    const rows = await this.runtime().query(query);
    return rows[0] ?? null;
  }

  async findObservationsByCopy(copyId: string) {
    const query = this.prisma.sql.public.observaciones_ejemplar
      .select('id', 'ejemplarId', 'descripcion', 'fecha', 'createdAt')
      .where((row, fns) => fns.eq(row.ejemplarId, copyId))
      .build();
    return await this.runtime().query(query);
  }
}
