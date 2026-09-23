import {
  BadRequestException,
  ConflictException,
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
    };
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
      if (error instanceof ConflictException || error?.code === '23505') {
        throw new ConflictException('Ya existe una categoría con ese nombre.');
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
    await this.repository.deleteCategory(categoryId);
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
      if (error instanceof ConflictException || error?.code === '23505') {
        throw new ConflictException(
          'Ya existe un recurso con ese nombre para la categoría indicada.',
        );
      }
      throw new InternalServerErrorException('No se pudo crear el recurso.');
    }
  }

  async listResources(filters?: {
    categoryId?: string;
    available?: string;
    search?: string;
  }) {
    const normalizedFilters: {
      categoryId?: string;
      available?: boolean;
      search?: string;
    } = {};
    if (filters?.categoryId) {
      if (!this.isUuid(filters.categoryId)) {
        throw new BadRequestException('categoryId no es un UUID válido.');
      }
      normalizedFilters.categoryId = filters.categoryId;
    }
    if (filters?.available !== undefined) {
      if (filters.available === 'true' || filters.available === 'false') {
        normalizedFilters.available = filters.available === 'true';
      } else {
        throw new BadRequestException('available debe ser true o false.');
      }
    }
    if (filters?.search) {
      normalizedFilters.search = this.normalizeText(filters.search, 'search')!;
    }

    const rows = await this.repository.findAllResources(normalizedFilters);
    const mapped = await Promise.all(
      rows.map(async (row: any) => {
        const total = await this.repository.countCopiesByResource(row.id);
        const available = await this.repository.countAvailableCopiesByResource(
          row.id,
        );
        return this.toResourceResponse({
          ...row,
          available: available > 0,
          totalCopies: total,
          availableCopies: available,
        });
      }),
    );

    if (normalizedFilters.available !== undefined) {
      return mapped.filter(
        (row) => row.available === normalizedFilters.available,
      );
    }

    return mapped;
  }

  async getResource(resourceId: string) {
    await this.ensureResourceExists(resourceId);
    const resource = await this.repository.findResourceById(resourceId);
    const category = await this.repository.findCategoryById(
      resource.categoriaId,
    );
    const total = await this.repository.countCopiesByResource(resourceId);
    const available =
      await this.repository.countAvailableCopiesByResource(resourceId);
    return {
      ...this.toResourceResponse({
        ...resource,
        available: available > 0,
        totalCopies: total,
        availableCopies: available,
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

    const updated = await this.repository.updateResource(
      resourceId,
      updateData,
    );
    return this.toResourceResponse(updated);
  }

  async deleteResource(resourceId: string) {
    await this.ensureResourceExists(resourceId);
    const copies = await this.repository.countCopiesByResource(resourceId);
    if (copies > 0) {
      throw new ConflictException(
        'No se puede eliminar el recurso porque tiene ejemplares asociados.',
      );
    }
    await this.repository.deleteResource(resourceId);
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
      if (error instanceof ConflictException || error?.code === '23505') {
        throw new ConflictException(
          'Ya existe un ejemplar con ese código de inventario.',
        );
      }
      throw new InternalServerErrorException('No se pudo crear el ejemplar.');
    }
  }

  async listCopiesByResource(resourceId: string) {
    await this.ensureResourceExists(resourceId);
    const rows = await this.repository.findCopiesByResource(resourceId);
    return rows.map((row: any) => this.toCopyResponse(row));
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
    const totalCopies = await this.repository.countCopiesByResource(resourceId);
    const availableCopies =
      await this.repository.countAvailableCopiesByResource(resourceId);
    const unavailableCopies = totalCopies - availableCopies;
    return {
      resourceId,
      available: availableCopies > 0,
      totalCopies,
      availableCopies,
      unavailableCopies,
      borrowedCopies: 0,
    };
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
