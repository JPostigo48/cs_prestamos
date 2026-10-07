import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiBody, ApiExtension, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InventoryService } from '../../application/use-cases/inventory.service.js';
import { CreateCategoryDto } from '../dto/create-category.dto.js';
import { CreateCopyDto } from '../dto/create-copy.dto.js';
import { CreateCopyObservationDto } from '../dto/create-copy-observation.dto.js';
import { CreateResourceDto } from '../dto/create-resource.dto.js';
import { UpdateCategoryDto } from '../dto/update-category.dto.js';
import { UpdateCopyStateDto } from '../dto/update-copy-state.dto.js';
import { UpdateResourceDto } from '../dto/update-resource.dto.js';

@ApiTags('Inventario')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  @Post('categories')
  @ApiBody({ type: CreateCategoryDto })
  @ApiOperation({ summary: 'Registrar categoría de recurso' })
  @ApiExtension('x-implementation-status', 'implemented')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.service.createCategory(dto);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Consultar categorías de recurso' })
  @ApiExtension('x-implementation-status', 'implemented')
  listCategories() {
    return this.service.listCategories();
  }

  @Get('categories/:categoryId')
  @ApiOperation({ summary: 'Consultar categoría de recurso' })
  @ApiExtension('x-implementation-status', 'implemented')
  getCategory(@Param('categoryId') categoryId: string) {
    return this.service.getCategory(categoryId);
  }

  @Patch('categories/:categoryId')
  @ApiBody({ type: UpdateCategoryDto })
  @ApiOperation({ summary: 'Modificar categoría de recurso' })
  @ApiExtension('x-implementation-status', 'implemented')
  updateCategory(
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.service.updateCategory(categoryId, dto);
  }

  @Delete('categories/:categoryId')
  @ApiOperation({ summary: 'Eliminar categoría de recurso' })
  @ApiExtension('x-implementation-status', 'implemented')
  deleteCategory(@Param('categoryId') categoryId: string) {
    return this.service.deleteCategory(categoryId);
  }

  @Post('resources')
  @ApiBody({ type: CreateResourceDto })
  @ApiOperation({ summary: 'Registrar recurso' })
  @ApiExtension('x-implementation-status', 'implemented')
  createResource(@Body() dto: CreateResourceDto) {
    return this.service.createResource(dto);
  }

  @Get('resources')
  @ApiQuery({ name: 'categoryId', required: false, type: String })
  @ApiQuery({ name: 'available', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiOperation({ summary: 'Consultar recursos' })
  @ApiExtension('x-implementation-status', 'implemented')
  listResources(
    @Query('categoryId') categoryId?: string,
    @Query('available') available?: string,
    @Query('search') search?: string,
  ) {
    return this.service.listResources({ categoryId, available, search });
  }

  @Get('resources/:resourceId')
  @ApiOperation({ summary: 'Consultar recurso' })
  @ApiExtension('x-implementation-status', 'implemented')
  getResource(@Param('resourceId') resourceId: string) {
    return this.service.getResource(resourceId);
  }

  @Patch('resources/:resourceId')
  @ApiBody({ type: UpdateResourceDto })
  @ApiOperation({ summary: 'Modificar recurso' })
  @ApiExtension('x-implementation-status', 'implemented')
  updateResource(
    @Param('resourceId') resourceId: string,
    @Body() dto: UpdateResourceDto,
  ) {
    return this.service.updateResource(resourceId, dto);
  }

  @Delete('resources/:resourceId')
  @ApiOperation({ summary: 'Eliminar recurso' })
  @ApiExtension('x-implementation-status', 'implemented')
  deleteResource(@Param('resourceId') resourceId: string) {
    return this.service.deleteResource(resourceId);
  }

  @Post('resources/:resourceId/copies')
  @ApiBody({ type: CreateCopyDto })
  @ApiOperation({ summary: 'Registrar ejemplar' })
  @ApiExtension('x-implementation-status', 'implemented')
  createCopy(
    @Param('resourceId') resourceId: string,
    @Body() dto: CreateCopyDto,
  ) {
    return this.service.createCopy(resourceId, dto);
  }

  @Get('resources/:resourceId/copies')
  @ApiOperation({ summary: 'Consultar ejemplares de un recurso' })
  @ApiExtension('x-implementation-status', 'implemented')
  listCopiesByResource(@Param('resourceId') resourceId: string) {
    return this.service.listCopiesByResource(resourceId);
  }

  @Get('copies/:copyId')
  @ApiOperation({ summary: 'Consultar ejemplar' })
  @ApiExtension('x-implementation-status', 'implemented')
  getCopy(@Param('copyId') copyId: string) {
    return this.service.getCopy(copyId);
  }

  @Patch('copies/:copyId/state')
  @ApiBody({ type: UpdateCopyStateDto })
  @ApiOperation({ summary: 'Modificar estado de un ejemplar' })
  @ApiExtension('x-implementation-status', 'implemented')
  updateCopyState(
    @Param('copyId') copyId: string,
    @Body() dto: UpdateCopyStateDto,
  ) {
    return this.service.updateCopyState(copyId, dto);
  }

  @Get('resources/:resourceId/availability')
  @ApiOperation({ summary: 'Consultar disponibilidad de un recurso' })
  @ApiExtension('x-implementation-status', 'implemented')
  getResourceAvailability(@Param('resourceId') resourceId: string) {
    return this.service.getResourceAvailability(resourceId);
  }

  @Post('copies/:copyId/observations')
  @ApiBody({ type: CreateCopyObservationDto })
  @ApiOperation({ summary: 'Registrar observación de un ejemplar' })
  @ApiExtension('x-implementation-status', 'implemented')
  createObservation(
    @Param('copyId') copyId: string,
    @Body() dto: CreateCopyObservationDto,
  ) {
    return this.service.createObservation(copyId, dto);
  }

  @Get('copies/:copyId/observations')
  @ApiOperation({ summary: 'Consultar observaciones de un ejemplar' })
  @ApiExtension('x-implementation-status', 'implemented')
  listObservationsByCopy(@Param('copyId') copyId: string) {
    return this.service.listObservationsByCopy(copyId);
  }
}
