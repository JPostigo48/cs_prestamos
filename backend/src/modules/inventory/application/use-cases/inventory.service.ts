import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  CreateCategoryInput,
  CreateCopyInput,
  CreateCopyObservationInput,
  CreateResourceInput,
  UpdateCategoryInput,
  UpdateCopyStateInput,
  UpdateResourceInput,
} from '../ports/inventory.inputs.js';
import { InventoryRepository } from '../../domain/repositories/inventory.repository.js';

@Injectable()
export class InventoryService {
  constructor(private readonly repository: InventoryRepository) {}

  private normalizeText(
    value: string | undefined | null,
    field: string,
  ): string | undefined {
    if (value === undefined || value === null) return undefined;
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new BadRequestException(`${field} no puede estar vacío.`);
    }
    return trimmed;
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  private isUniqueViolation(error: any): boolean {
    return error?.code === '23505' || error?.cause?.code === '23505';
  }

  private async ensureCategoryExists(categoryId: string) {
    if (!this.isUuid(categoryId)) {
      throw new BadRequestException('categoryId no es un UUID válido.');
    }
    const category = await this.repository.findCategoryById(categoryId);
    if (!category) {
      throw new NotFoundException('Categoría no encontrada.');
    }
    return category;
  }

  private async ensureResourceExists(resourceId: string) {
    if (!this.isUuid(resourceId)) {
      throw new BadRequestException('resourceId no es un UUID válido.');
    }
    const resource = await this.repository.findResourceById(resourceId);
    if (!resource) {
      throw new NotFoundException('Recurso no encontrado.');
    }
    return resource;
  }

  private async ensureCopyExists(copyId: string) {
    if (!this.isUuid(copyId)) {
      throw new BadRequestException('copyId no es un UUID válido.');
    }
    const copy = await this.repository.findCopyById(copyId);
    if (!copy) {
      throw new NotFoundException('Ejemplar no encontrado.');
    }
    return copy;
  }

  private toCategoryResponse(row: any) {
    return {
      id: row.id,
      nombre: row.nombre,
      tiempoMaximoPrestamoDias: row.tiempoMaximoPrestamoDias,
      resourceCount: row.resourceCount ?? 0,
    };
  }

  private toResourceResponse(row: any) {
    return {
      id: row.id,
      categoriaId: row.categoriaId,
      nombre: row.nombre,
      descripcion: row.descripcion ?? null,
      available: row.available ?? false,
      totalCopies: row.totalCopies ?? 0,
      availableCopies: row.availableCopies ?? 0,
      ...(row.categoria
        ? {
            categoria: {
              id: row.categoria.id,
              nombre: row.categoria.nombre,
            },
          }
        : {}),
    };
  }

  private async getAvailabilityCounts(resourceId: string) {
    const [disponibles, prestados, noDisponibles] = await Promise.all([
      this.repository.countCopiesByResourceAndState(resourceId, 'DISPONIBLE'),
      this.repository.countCopiesByResourceAndState(resourceId, 'PRESTADO'),
      this.repository.countCopiesByResourceAndState(
        resourceId,
        'NO_DISPONIBLE',
      ),
    ]);
    return { disponibles, prestados, noDisponibles };
  }

  private async mapResourceRows(rows: any[]) {
    const categories = new Map<string, Promise<any>>();
    return Promise.all(
      rows.map(async (row: any) => {
        let categoryPromise = categories.get(row.categoriaId);
        if (!categoryPromise) {
          categoryPromise = this.repository.findCategoryById(row.categoriaId);
          categories.set(row.categoriaId, categoryPromise);
        }
        const [category, counts] = await Promise.all([
          categoryPromise,
          this.getAvailabilityCounts(row.id),
        ]);
        return this.toResourceResponse({
          ...row,
          categoria: category
            ? { id: category.id, nombre: category.nombre }
            : null,
          available: counts.disponibles > 0,
          totalCopies:
            counts.disponibles + counts.prestados + counts.noDisponibles,
          availableCopies: counts.disponibles,
        });
      }),
    );
  }

  private toCopyResponse(row: any) {
    return {
      id: row.id,
      recursoId: row.recursoId,
      codigoInventario: row.codigoInventario,
      estado: row.estado,
    };
  }

  private toObservationResponse(row: any) {
    return {
      id: row.id,
      ejemplarId: row.ejemplarId,
      descripcion: row.descripcion,
      fecha: row.fecha,
    };
  }

  async createCategory(dto: CreateCategoryInput) {
    const nombre = this.normalizeText(dto.nombre, 'nombre');
    if (!nombre) {
      throw new BadRequestException('nombre es obligatorio.');
    }
    if (
      !Number.isInteger(dto.tiempoMaximoPrestamoDias) ||
      dto.tiempoMaximoPrestamoDias <= 0
    ) {
      throw new BadRequestException(
        'tiempoMaximoPrestamoDias debe ser un entero positivo.',
      );
    }

    try {
      const created = await this.repository.createCategory({
        nombre,
        tiempoMaximoPrestamoDias: dto.tiempoMaximoPrestamoDias,
      });
      return this.toCategoryResponse(created[0] ?? created);
    } catch (error: any) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Ya existe una categoría con ese nombre.');
      }
      if (error instanceof HttpException || error instanceof Error) {
        throw error;
      }
      throw new InternalServerErrorException('No se pudo crear la categoría.');
    }
  }

  async listCategories() {
    const rows = await this.repository.findAllCategories();
    const categories = await Promise.all(
      rows.map(async (row: any) => {
        const resourceCount = await this.repository.countResourcesByCategory(
          row.id,
        );
        return this.toCategoryResponse({ ...row, resourceCount });
      }),
    );
    return categories;
  }

  async getCategory(categoryId: string) {
    if (!this.isUuid(categoryId)) {
      throw new BadRequestException('categoryId no es un UUID válido.');
    }
    const category = await this.repository.findCategoryById(categoryId);
    if (!category) {
      throw new NotFoundException('Categoría no encontrada.');
    }
    const resourceCount =
      await this.repository.countResourcesByCategory(categoryId);
    return this.toCategoryResponse({ ...category, resourceCount });
  }

  async updateCategory(categoryId: string, dto: UpdateCategoryInput) {
    await this.ensureCategoryExists(categoryId);

    const updateData: Partial<{
      nombre: string;
      tiempoMaximoPrestamoDias: number;
    }> = {};
    if (dto.nombre !== undefined) {
      const nombre = this.normalizeText(dto.nombre, 'nombre');
      updateData.nombre = nombre!;
    }
    if (dto.tiempoMaximoPrestamoDias !== undefined) {
      if (
        !Number.isInteger(dto.tiempoMaximoPrestamoDias) ||
        dto.tiempoMaximoPrestamoDias <= 0
      ) {
        throw new BadRequestException(
          'tiempoMaximoPrestamoDias debe ser un entero positivo.',
        );
      }
      updateData.tiempoMaximoPrestamoDias = dto.tiempoMaximoPrestamoDias;
    }

    const updated = await this.repository.updateCategory(
      categoryId,
      updateData,
    );
    return this.toCategoryResponse(updated);
  }

  async deleteCategory(categoryId: string) {
    await this.ensureCategoryExists(categoryId);
    const count = await this.repository.countResourcesByCategory(categoryId);
    if (count > 0) {
      throw new ConflictException(
        'No se puede eliminar la categoría porque tiene recursos asociados.',
      );
    }
    const deleted = await this.repository.deleteCategory(categoryId);
    if (deleted === 0) {
      throw new NotFoundException('Categoría no encontrada.');
    }
    return { deleted: true, categoryId };
  }

  async createResource(dto: CreateResourceInput) {
    if (!this.isUuid(dto.categoriaId)) {
      throw new BadRequestException('categoriaId no es un UUID válido.');
    }
    await this.ensureCategoryExists(dto.categoriaId);

    const nombre = this.normalizeText(dto.nombre, 'nombre');
    const descripcion =
      dto.descripcion !== undefined
        ? (this.normalizeText(dto.descripcion ?? '', 'descripcion') ?? null)
        : null;

    try {
      const created = await this.repository.createResource({
        categoriaId: dto.categoriaId,
        nombre: nombre!,
        descripcion,
      });
      return this.toResourceResponse(created[0] ?? created);
    } catch (error: any) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'Ya existe un recurso con ese nombre para la categoría indicada.',
        );
      }
      if (error instanceof HttpException || error instanceof Error) {
        throw error;
      }
      throw new InternalServerErrorException('No se pudo crear el recurso.');
    }
  }

  async listResources(filters?: {
    categoryId?: string;
    available?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;
    const offset = (page - 1) * limit;
    const normalizedFilters: {
      categoryId?: string;
      available?: boolean;
      search?: string;
    } = {
      categoryId: filters?.categoryId,
      available:
        filters?.available === undefined
          ? undefined
          : filters.available === 'true',
      search: filters?.search,
    };

    const rows = await this.repository.findAllResources(
      normalizedFilters.available === undefined
        ? { ...normalizedFilters, limit, offset }
        : normalizedFilters,
    );
    const mapped = await this.mapResourceRows(rows);
    const filtered =
      normalizedFilters.available === undefined
        ? mapped
        : mapped.filter(
            (row) => row.available === normalizedFilters.available,
          );
    const data =
      normalizedFilters.available === undefined
        ? filtered
        : filtered.slice(offset, offset + limit);
    const total =
      normalizedFilters.available === undefined
        ? await this.repository.countResources(normalizedFilters)
        : filtered.length;
    return { data, total, page, limit };
  }

  async getResource(resourceId: string) {
    await this.ensureResourceExists(resourceId);
    const resource = await this.repository.findResourceById(resourceId);
    const category = await this.repository.findCategoryById(
      resource.categoriaId,
    );
    const counts = await this.getAvailabilityCounts(resourceId);
    return {
      ...this.toResourceResponse({
        ...resource,
        available: counts.disponibles > 0,
        totalCopies:
          counts.disponibles + counts.prestados + counts.noDisponibles,
        availableCopies: counts.disponibles,
      }),
      categoria: category
        ? {
            id: category.id,
            nombre: category.nombre,
            tiempoMaximoPrestamoDias: category.tiempoMaximoPrestamoDias,
          }
        : null,
    };
  }

  async updateResource(resourceId: string, dto: UpdateResourceInput) {
    await this.ensureResourceExists(resourceId);
    const updateData: Partial<{
      categoriaId: string;
      nombre: string;
      descripcion?: string | null;
    }> = {};

    if (dto.categoriaId !== undefined) {
      if (!this.isUuid(dto.categoriaId)) {
        throw new BadRequestException('categoriaId no es un UUID válido.');
      }
      await this.ensureCategoryExists(dto.categoriaId);
      updateData.categoriaId = dto.categoriaId;
    }
    if (dto.nombre !== undefined) {
      updateData.nombre = this.normalizeText(dto.nombre, 'nombre')!;
    }
    if (dto.descripcion !== undefined) {
      updateData.descripcion =
        dto.descripcion === undefined || dto.descripcion === null
          ? null
          : (this.normalizeText(dto.descripcion, 'descripcion') ?? null);
    }

    try {
      const updated = await this.repository.updateResource(
        resourceId,
        updateData,
      );
      return this.toResourceResponse(updated);
    } catch (error: any) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'Ya existe un recurso con ese nombre para la categoría indicada.',
        );
      }
      if (error instanceof HttpException || error instanceof Error) {
        throw error;
      }
      throw new InternalServerErrorException('No se pudo actualizar el recurso.');
    }
  }

  async deleteResource(resourceId: string) {
    await this.ensureResourceExists(resourceId);
    const copies = await this.repository.countCopiesByResource(resourceId);
    if (copies > 0) {
      throw new ConflictException(
        'No se puede eliminar el recurso porque tiene ejemplares asociados.',
      );
    }
    const deleted = await this.repository.deleteResource(resourceId);
    if (deleted === 0) {
      throw new NotFoundException('Recurso no encontrado.');
    }
    return { deleted: true, resourceId };
  }

  async createCopy(resourceId: string, dto: CreateCopyInput) {
    await this.ensureResourceExists(resourceId);
    const codigoInventario = this.normalizeText(
      dto.codigoInventario,
      'codigoInventario',
    );
    if (!codigoInventario)
      throw new BadRequestException('codigoInventario es obligatorio.');

    try {
      const created = await this.repository.createCopy({
        recursoId: resourceId,
        codigoInventario,
        estado: 'DISPONIBLE',
      });
      return this.toCopyResponse(created[0] ?? created);
    } catch (error: any) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'Ya existe un ejemplar con ese código de inventario.',
        );
      }
      if (error instanceof HttpException || error instanceof Error) {
        throw error;
      }
      throw new InternalServerErrorException('No se pudo crear el ejemplar.');
    }
  }

  async listCopiesByResource(resourceId: string) {
    await this.ensureResourceExists(resourceId);
    const rows = await this.repository.findCopiesByResource(resourceId);
    return rows.map((row: any) => this.toCopyResponse(row));
  }

  async deleteCopy(copyId: string) {
    await this.ensureCopyExists(copyId);
    const deleted = await this.repository.deleteCopy(copyId);
    if (deleted === 0) {
      throw new NotFoundException('Ejemplar no encontrado.');
    }
    return { deleted: true, copyId };
  }

  async getCopy(copyId: string) {
    const copy = await this.ensureCopyExists(copyId);
    const resource = await this.ensureResourceExists(copy.recursoId);
    const observations = await this.repository.findObservationsByCopy(copyId);
    return {
      ...this.toCopyResponse(copy),
      recurso: {
        id: resource.id,
        nombre: resource.nombre,
        categoriaId: resource.categoriaId,
      },
      observaciones: observations.map((row: any) =>
        this.toObservationResponse(row),
      ),
    };
  }

  async getLoanAvailability(copyId: string) {
    const copy = await this.ensureCopyExists(copyId);
    const resource = await this.ensureResourceExists(copy.recursoId);
    const category = await this.getCategory(resource.categoriaId);
    return {
      copyId,
      available: copy.estado === 'DISPONIBLE',
      maximumLoanDays: category.tiempoMaximoPrestamoDias,
    };
  }

  async markCopyAsLoaned(copyId: string): Promise<void> {
    const copy = await this.ensureCopyExists(copyId);
    if (copy.estado !== 'DISPONIBLE') {
      throw new ConflictException('El ejemplar no está disponible.');
    }
    await this.repository.markCopyAsLoaned(copyId);
  }

  async releaseCopyAfterReturn(
    copyId: string,
    observation?: string,
  ): Promise<void> {
    await this.ensureCopyExists(copyId);
    await this.repository.updateCopyState(
      copyId,
      observation?.trim() ? 'NO_DISPONIBLE' : 'DISPONIBLE',
    );
    if (observation?.trim()) {
      await this.repository.createObservation({
        ejemplarId: copyId,
        descripcion: observation.trim(),
      });
    }
  }

  async updateCopyState(copyId: string, dto: UpdateCopyStateInput) {
    const copy = await this.ensureCopyExists(copyId);
    if (dto.estado === 'PRESTADO') {
      throw new UnprocessableEntityException(
        'Inventario no puede marcar un ejemplar como PRESTADO; ese cambio corresponde al módulo de Préstamos.',
      );
    }
    const allowedStates = ['DISPONIBLE', 'NO_DISPONIBLE'] as const;
    if (!allowedStates.includes(dto.estado as (typeof allowedStates)[number])) {
      throw new UnprocessableEntityException(
        'Estado inválido para inventario.',
      );
    }
    if (copy.estado === dto.estado) {
      return this.toCopyResponse(copy);
    }
    const updated = await this.repository.updateCopyState(copyId, dto.estado);
    return this.toCopyResponse(updated);
  }

  async getResourceAvailability(resourceId: string) {
    await this.ensureResourceExists(resourceId);
    const counts = await this.getAvailabilityCounts(resourceId);
    const totalCopies =
      counts.disponibles + counts.prestados + counts.noDisponibles;
    return {
      resourceId,
      available: counts.disponibles > 0,
      totalCopies,
      disponibles: counts.disponibles,
      prestados: counts.prestados,
      noDisponibles: counts.noDisponibles,
    };
  }

  async getGlobalAvailability() {
    const resources = await this.repository.findAllResources();
    const categories = new Map<string, Promise<any>>();
    return Promise.all(
      resources.map(async (row: any) => {
        let categoryPromise = categories.get(row.categoriaId);
        if (!categoryPromise) {
          categoryPromise = this.repository.findCategoryById(row.categoriaId);
          categories.set(row.categoriaId, categoryPromise);
        }
        const [category, counts] = await Promise.all([
          categoryPromise,
          this.getAvailabilityCounts(row.id),
        ]);
        return {
          ...this.toResourceResponse({
            ...row,
            categoria: category
              ? { id: category.id, nombre: category.nombre }
              : null,
            available: counts.disponibles > 0,
            totalCopies:
              counts.disponibles + counts.prestados + counts.noDisponibles,
            availableCopies: counts.disponibles,
          }),
          disponibles: counts.disponibles,
          prestados: counts.prestados,
          noDisponibles: counts.noDisponibles,
        };
      }),
    );
  }

  async createObservation(copyId: string, dto: CreateCopyObservationInput) {
    await this.ensureCopyExists(copyId);
    const descripcion = this.normalizeText(dto.descripcion, 'descripcion');
    if (!descripcion) {
      throw new BadRequestException('descripcion es obligatoria.');
    }
    const created = await this.repository.createObservation({
      ejemplarId: copyId,
      descripcion,
    });
    return this.toObservationResponse(created[0] ?? created);
  }

  async listObservationsByCopy(copyId: string) {
    await this.ensureCopyExists(copyId);
    const rows = await this.repository.findObservationsByCopy(copyId);
    return rows.map((row: any) => this.toObservationResponse(row));
  }
}
