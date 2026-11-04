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
import type { CategoryDeletionPreview } from '../../../domain/entities/category-deletion.js';
import { categoryPolicyConfiguration } from '../../../../rules/domain/category-policy.js';
import { PrismaTermsRepository } from '../../../../rules/infrastructure/persistence/prisma/prisma-terms.repository.js';
import {
  normalizeAccessoryName,
  type ResourceAccessoryInput,
  type StoredResourceAccessory,
} from '../../../domain/entities/resource-configuration.js';

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

  /** Lecturas de configuración en la transacción coordinadora de préstamos. */
  forTransaction(runtime: QueryRuntime): PrismaInventoryRepository {
    const scoped = new PrismaInventoryRepository(this.prisma);
    scoped.transactionRuntime = runtime;
    return scoped;
  }

  private async lockResource(runtime: QueryRuntime, resourceId: string) {
    const rows = await runtime.query(
      this.prisma.sql.public.recursos
        .update({ updatedAt: Temporal.Now.instant() })
        .where((row, fns) => fns.eq(row.id, resourceId))
        .returning('id')
        .build(),
    );
    if (!rows[0]) throw new NotFoundException('Recurso no encontrado.');
  }

  async findResourceAccessories(
    resourceId: string,
  ): Promise<StoredResourceAccessory[]> {
    return this.runtime().query(
      this.prisma.sql.public.accesorios_recurso
        .select('id', 'recursoId', 'nombre', 'nombreNormalizado', 'activo')
        .where((row, fns) => fns.eq(row.recursoId, resourceId))
        .build(),
    );
  }

  async replaceResourceAccessories(
    resourceId: string,
    items: ResourceAccessoryInput[],
  ): Promise<StoredResourceAccessory[]> {
    return this.copyTransaction(async (runtime) => {
      // Serializa reemplazos de la misma plantilla. No se borran IDs históricos.
      await this.lockResource(runtime, resourceId);
      const previous = await runtime.query(
        this.prisma.sql.public.accesorios_recurso
          .select('id', 'recursoId', 'nombre', 'nombreNormalizado', 'activo')
          .where((row, fns) => fns.eq(row.recursoId, resourceId))
          .build(),
      );
      const next = items.map((item) => {
        const nombreNormalizado = normalizeAccessoryName(item.nombre);
        const existing = item.id
          ? previous.find((row) => row.id === item.id)
          : previous.find((row) => row.nombreNormalizado === nombreNormalizado);
        if (item.id && !existing)
          throw new NotFoundException(
            'El accesorio no pertenece a este recurso.',
          );
        return { ...item, nombreNormalizado, existing };
      });
      if (
        new Set(next.map((item) => item.existing?.id).filter(Boolean)).size !==
        next.filter((item) => item.existing).length
      )
        throw new ConflictException(
          'Un accesorio no puede aparecer dos veces.',
        );
      await runtime.query(
        this.prisma.sql.public.accesorios_recurso
          .update({ activo: false })
          .where((row, fns) => fns.eq(row.recursoId, resourceId))
          .returning('id')
          .build(),
      );
      const result: StoredResourceAccessory[] = [];
      for (const item of next) {
        const data = {
          nombre: item.nombre,
          nombreNormalizado: item.nombreNormalizado,
          activo: true,
        };
        const table = this.prisma.sql.public.accesorios_recurso;
        const query = item.existing
          ? table
              .update(data)
              .where((row, fns) => fns.eq(row.id, item.existing!.id))
          : table.insert([{ ...data, recursoId: resourceId }]);
        const rows = await runtime.query(
          query
            .returning(
              'id',
              'recursoId',
              'nombre',
              'nombreNormalizado',
              'activo',
            )
            .build(),
        );
        result.push(rows[0]!);
      }
      return result;
    });
  }

  async updateResourceLoanPolicy(
    resourceId: string,
    durationHours: number | null,
  ): Promise<void> {
    const rows = await this.runtime().query(
      this.prisma.sql.public.recursos
        .update({ duracionPrestamoHoras: durationHours })
        .where((row, fns) => fns.eq(row.id, resourceId))
        .returning('id')
        .build(),
    );
    if (!rows[0]) throw new NotFoundException('Recurso no encontrado.');
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
    descripcion?: string | null;
    activo?: boolean;
    tiempoMaximoPrestamoDias: number;
    tiempoMaximoPrestamoHoras?: number;
  }) {
    const query = this.prisma.sql.public.categorias_recurso
      .insert([
        {
          nombre: data.nombre,
          descripcion: data.descripcion ?? null,
          activo: data.activo ?? true,
          tiempoMaximoPrestamoDias: data.tiempoMaximoPrestamoDias,
          tiempoMaximoPrestamoHoras:
            data.tiempoMaximoPrestamoHoras ??
            data.tiempoMaximoPrestamoDias * 24,
        },
      ])
      .returning(
        'id',
        'nombre',
        'descripcion',
        'activo',
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
        'descripcion',
        'activo',
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
        'descripcion',
        'activo',
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
      descripcion: string | null;
      activo: boolean;
      tiempoMaximoPrestamoDias: number;
      tiempoMaximoPrestamoHoras: number;
    }>,
  ) {
    const query = this.prisma.sql.public.categorias_recurso
      .update({
        ...(data.nombre !== undefined ? { nombre: data.nombre } : {}),
        ...(data.descripcion !== undefined
          ? { descripcion: data.descripcion }
          : {}),
        ...(data.activo !== undefined ? { activo: data.activo } : {}),
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
        'descripcion',
        'activo',
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
    try {
      return await this.copyTransaction(async (runtime) => {
        // Las referencias JSON/texto no tienen FK. El bloqueo impide escritores
        // concurrentes entre la revalidación y el borrado; NOWAIT evita esperas
        // largas/deadlocks con circulación. No se usa una cascada destructiva.
        await runtime.query(
          this.prisma.client.raw.sql`
          LOCK TABLE public.categorias_recurso, public.recursos,
            public.ejemplares, public.accesorios_recurso,
            public.observaciones_ejemplar, public.reservas, public.prestamos,
            public.inspecciones_devolucion, public.versiones_regla,
            public.versiones_terminos, public.auditorias_usuario
          IN SHARE ROW EXCLUSIVE MODE NOWAIT
        `
            .returnsRow({})
            .build(),
        );
        const scoped = this.forTransaction(runtime);
        const preview = await scoped.previewCategoryDeletion(categoryId);
        if (!preview.canDelete)
          throw new ConflictException(
            'La categoría tiene historial o dependencias que deben conservarse. Puede desactivarla.',
          );
        const sql = this.prisma.sql.public;
        for (const id of preview.copyIds)
          await runtime.query(
            sql.ejemplares
              .delete()
              .where((r, f) => f.eq(r.id, id))
              .returning('id')
              .build(),
          );
        for (const id of preview.accessoryIds)
          await runtime.query(
            sql.accesorios_recurso
              .delete()
              .where((r, f) => f.eq(r.id, id))
              .returning('id')
              .build(),
          );
        for (const id of preview.resourceIds)
          await runtime.query(
            sql.recursos
              .delete()
              .where((r, f) => f.eq(r.id, id))
              .returning('id')
              .build(),
          );
        const rows = await runtime.query(
          sql.categorias_recurso
            .delete()
            .where((r, f) => f.eq(r.id, categoryId))
            .returning('id')
            .build(),
        );
        return rows.length;
      });
    } catch (error) {
      const e = error as { code?: string; cause?: { code?: string } };
      if (
        ['23503', '23505', '55P03', '40P01', '40001'].includes(
          e.cause?.code ?? e.code ?? '',
        )
      )
        throw new ConflictException(
          'No se pudo eliminar por dependencias o una operación concurrente. Reintente o desactive la categoría.',
        );
      throw error;
    }
  }

  async getCategoryPolicies(categoryId: string) {
    const runtime = this.runtime();
    const terms = await new PrismaTermsRepository(this.prisma)
      .forTransaction(runtime)
      .readPublicVersion();
    const sql = this.prisma.sql.public;
    const rules = await runtime.query(
      sql.reglas_uso.select('versionVigenteId').build(),
    );
    const versions = await runtime.query(
      sql.versiones_regla.select('id', 'estado').build(),
    );
    const active = new Set(
      versions
        .filter(
          (v) =>
            v.estado === 'ACTIVA' &&
            rules.some((r) => r.versionVigenteId === v.id),
        )
        .map((v) => v.id),
    );
    return categoryPolicyConfiguration(terms, categoryId, active);
  }

  async previewCategoryDeletion(
    categoryId: string,
  ): Promise<CategoryDeletionPreview> {
    const category = await this.findCategoryById(categoryId);
    if (!category) throw new NotFoundException('Categoría no encontrada.');
    const resources = await this.findAllResources({ categoryId });
    const resourceIds = resources.map((r) => r.id as string);
    const copies = (
      await Promise.all(resourceIds.map((id) => this.findCopiesByResource(id)))
    ).flat();
    const copyIds = copies.map((c) => c.id as string);
    const accessories = (
      await Promise.all(
        resourceIds.map((id) => this.findResourceAccessories(id)),
      )
    ).flat();
    const accessoryIds = accessories.map((a) => a.id);
    const ids = [categoryId, ...resourceIds, ...copyIds, ...accessoryIds];
    // Conservador: también conserva referencias embebidas en texto histórico.
    const references = (value: unknown) =>
      ids.some((id) =>
        JSON.stringify(value ?? '')
          .toLowerCase()
          .includes(id.toLowerCase()),
      );
    const sql = this.prisma.sql.public;
    const runtime = this.runtime();
    const blockers: CategoryDeletionPreview['blockers'] = [];
    const add = (dependency: string, count: number) => {
      if (count)
        blockers.push({
          dependency,
          count,
          reason:
            'Referencia histórica o configuración versionada; desactive para conservarla.',
        });
    };
    const reservations = await runtime.query(
      sql.reservas.select('id', 'ejemplarId', 'configurationSnapshot').build(),
    );
    const loans = await runtime.query(
      sql.prestamos.select('id', 'ejemplarId', 'configurationSnapshot').build(),
    );
    const observations = await runtime.query(
      sql.observaciones_ejemplar.select('id', 'ejemplarId').build(),
    );
    const inspections = await runtime.query(
      sql.inspecciones_devolucion
        .select('id', 'configurationSnapshot', 'parts')
        .build(),
    );
    const versions = await runtime.query(
      sql.versiones_regla.select('id', 'descripcion').build(),
    );
    const terms = await runtime.query(
      sql.versiones_terminos.select('id', 'contenido').build(),
    );
    const audits = await runtime.query(
      sql.auditorias_usuario
        .select('id', 'datosAnteriores', 'datosNuevos', 'motivo')
        .build(),
    );
    add('reservas', reservations.filter(references).length);
    add('prestamos', loans.filter(references).length);
    add('observaciones_ejemplar', observations.filter(references).length);
    add('inspecciones_devolucion', inspections.filter(references).length);
    add('versiones_regla', versions.filter(references).length);
    add('versiones_terminos', terms.filter(references).length);
    add('auditorias_usuario', audits.filter(references).length);
    add(
      'operaciones_pendientes',
      copies.filter((c) => c.estado === 'PRESTADO' || c.estado === 'RESERVADO')
        .length,
    );
    const canDelete = blockers.length === 0;
    return {
      categoryId,
      nombre: category.nombre,
      resourceIds,
      copyIds,
      accessoryIds,
      resourceCount: resourceIds.length,
      copyCount: copyIds.length,
      blockers,
      canDelete,
      wouldDelete: {
        categories: canDelete ? 1 : 0,
        resources: canDelete ? resourceIds.length : 0,
        copies: canDelete ? copyIds.length : 0,
        accessories: canDelete ? accessoryIds.length : 0,
      },
      alternative: 'DEACTIVATE',
    };
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
    activo?: boolean;
    nombre: string;
    descripcion?: string | null;
  }) {
    const query = this.prisma.sql.public.recursos
      .insert([
        {
          categoriaId: data.categoriaId,
          activo: data.activo ?? true,
          nombre: data.nombre,
          descripcion: data.descripcion ?? null,
        },
      ])
      .returning(
        'id',
        'activo',
        'categoriaId',
        'nombre',
        'descripcion',
        'duracionPrestamoHoras',
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
      'activo',
      'categoriaId',
      'nombre',
      'descripcion',
      'duracionPrestamoHoras',
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
        'activo',
        'categoriaId',
        'nombre',
        'descripcion',
        'duracionPrestamoHoras',
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
      activo: boolean;
      nombre: string;
      descripcion?: string | null;
    }>,
  ) {
    const query = this.prisma.sql.public.recursos
      .update({
        ...(data.categoriaId !== undefined
          ? { categoriaId: data.categoriaId }
          : {}),
        ...(data.activo !== undefined ? { activo: data.activo } : {}),
        ...(data.nombre !== undefined ? { nombre: data.nombre } : {}),
        ...(data.descripcion !== undefined
          ? { descripcion: data.descripcion ?? null }
          : {}),
      })
      .where((row, fns) => fns.eq(row.id, resourceId))
      .returning(
        'id',
        'activo',
        'categoriaId',
        'nombre',
        'descripcion',
        'duracionPrestamoHoras',
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
