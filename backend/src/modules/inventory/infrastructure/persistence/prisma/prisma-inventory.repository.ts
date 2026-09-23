import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service.js';
import type {
  InventoryCopyStateManaged,
  InventoryCopyStatus,
} from '../../../domain/entities/inventory.types.js';
import { InventoryRepository } from '../../../domain/repositories/inventory.repository.js';

@Injectable()
export class PrismaInventoryRepository extends InventoryRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  private runtime() {
    return (this.prisma.client as any).runtime();
  }

  async createCategory(data: {
    nombre: string;
    tiempoMaximoPrestamoDias: number;
  }) {
    const query = this.prisma.sql.public.categorias_recurso
      .insert([
        {
          nombre: data.nombre,
          tiempoMaximoPrestamoDias: data.tiempoMaximoPrestamoDias,
        },
      ])
      .returning(
        'id',
        'nombre',
        'tiempoMaximoPrestamoDias',
        'createdAt',
        'updatedAt',
      )
      .build();
    const rows = await this.runtime().query(query);
    return rows[0] ?? null;
  }

  async findAllCategories() {
    const query = this.prisma.sql.public.categorias_recurso
      .select('id', 'nombre', 'tiempoMaximoPrestamoDias')
      .build();
    return await this.runtime().query(query);
  }

  async findCategoryById(categoryId: string) {
    const query = this.prisma.sql.public.categorias_recurso
      .select(
        'id',
        'nombre',
        'tiempoMaximoPrestamoDias',
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
    data: Partial<{ nombre: string; tiempoMaximoPrestamoDias: number }>,
  ) {
    const query = this.prisma.sql.public.categorias_recurso
      .update({
        ...(data.nombre !== undefined ? { nombre: data.nombre } : {}),
        ...(data.tiempoMaximoPrestamoDias !== undefined
          ? { tiempoMaximoPrestamoDias: data.tiempoMaximoPrestamoDias }
          : {}),
      })
      .where((row, fns) => fns.eq(row.id, categoryId))
      .returning(
        'id',
        'nombre',
        'tiempoMaximoPrestamoDias',
        'createdAt',
        'updatedAt',
      )
      .build();
    const rows = await this.runtime().query(query);
    return rows[0] ?? null;
  }

  async deleteCategory(categoryId: string) {
    const query = this.prisma.sql.public.categorias_recurso
      .delete()
      .where((row, fns) => fns.eq(row.id, categoryId))
      .build();
    return await this.runtime().execute(query);
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

    const query = base.build();
    return await this.runtime().query(query);
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
      .build();
    return await this.runtime().execute(query);
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
