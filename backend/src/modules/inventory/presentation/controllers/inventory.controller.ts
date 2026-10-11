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
import {
  ApiBody,
  ApiCreatedResponse,
  ApiExtension,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { InventoryService } from '../../application/use-cases/inventory.service.js';
import { CreateCategoryDto } from '../dto/create-category.dto.js';
import { CreateCopyDto } from '../dto/create-copy.dto.js';
import { CreateCopyObservationDto } from '../dto/create-copy-observation.dto.js';
import { CreateResourceDto } from '../dto/create-resource.dto.js';
import { UpdateCategoryDto } from '../dto/update-category.dto.js';
import { UpdateCopyStateDto } from '../dto/update-copy-state.dto.js';
import { UpdateResourceDto } from '../dto/update-resource.dto.js';
import { ListResourcesQueryDto } from '../dto/list-resources-query.dto.js';
import {
  CategoryResponseDto,
  CopyDetailResponseDto,
  CopyResponseDto,
  DeletedCategoryResponseDto,
  DeletedResourceResponseDto,
  ObservationResponseDto,
  ResourceAvailabilityResponseDto,
  ResourceDetailResponseDto,
  ResourceResponseDto,
} from '../dto/inventory-response.dto.js';

@ApiTags('Inventario')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  @Post('categories')
  @ApiBody({ type: CreateCategoryDto })
  @ApiOperation({ summary: 'Registrar categoría de recurso' })
  @ApiCreatedResponse({ type: CategoryResponseDto })
  @ApiExtension('x-implementation-status', 'implemented')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.service.createCategory(dto);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Consultar categorías de recurso' })
  @ApiOkResponse({ type: CategoryResponseDto, isArray: true })
  @ApiExtension('x-implementation-status', 'implemented')
  listCategories() {
    return this.service.listCategories();
  }

  @Get('categories/:categoryId')
  @ApiOperation({ summary: 'Consultar categoría de recurso' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiExtension('x-implementation-status', 'implemented')
  getCategory(@Param('categoryId') categoryId: string) {
    return this.service.getCategory(categoryId);
  }

  @Patch('categories/:categoryId')
  @ApiBody({ type: UpdateCategoryDto })
  @ApiOperation({ summary: 'Modificar categoría de recurso' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiExtension('x-implementation-status', 'implemented')
  updateCategory(
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.service.updateCategory(categoryId, dto);
  }

  @Delete('categories/:categoryId')
  @ApiOperation({ summary: 'Eliminar categoría de recurso' })
  @ApiOkResponse({ type: DeletedCategoryResponseDto })
  @ApiExtension('x-implementation-status', 'implemented')
  deleteCategory(@Param('categoryId') categoryId: string) {
    return this.service.deleteCategory(categoryId);
  }

  @Post('resources')
  @ApiBody({ type: CreateResourceDto })
  @ApiOperation({ summary: 'Registrar recurso' })
  @ApiCreatedResponse({ type: ResourceResponseDto })
  @ApiExtension('x-implementation-status', 'implemented')
  createResource(@Body() dto: CreateResourceDto) {
    return this.service.createResource(dto);
  }

  @Get('resources')
  @ApiQuery({ name: 'categoryId', required: false, type: String })
  @ApiQuery({ name: 'available', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiOperation({ summary: 'Consultar recursos' })
  @ApiOkResponse({ type: ResourceResponseDto, isArray: true })
  @ApiExtension('x-implementation-status', 'implemented')
  listResources(@Query() query: ListResourcesQueryDto) {
    return this.service.listResources(query);
  }

  @Get('resources/:resourceId')
  @ApiOperation({ summary: 'Consultar recurso' })
  @ApiOkResponse({ type: ResourceDetailResponseDto })
  @ApiExtension('x-implementation-status', 'implemented')
  getResource(@Param('resourceId') resourceId: string) {
    return this.service.getResource(resourceId);
  }

  @Patch('resources/:resourceId')
  @ApiBody({ type: UpdateResourceDto })
  @ApiOperation({ summary: 'Modificar recurso' })
  @ApiOkResponse({ type: ResourceResponseDto })
  @ApiExtension('x-implementation-status', 'implemented')
  updateResource(
    @Param('resourceId') resourceId: string,
    @Body() dto: UpdateResourceDto,
  ) {
    return this.service.updateResource(resourceId, dto);
  }

  @Delete('resources/:resourceId')
  @ApiOperation({ summary: 'Eliminar recurso' })
  @ApiOkResponse({ type: DeletedResourceResponseDto })
  @ApiExtension('x-implementation-status', 'implemented')
  deleteResource(@Param('resourceId') resourceId: string) {
    return this.service.deleteResource(resourceId);
  }

  @Post('resources/:resourceId/copies')
  @ApiBody({ type: CreateCopyDto })
  @ApiOperation({ summary: 'Registrar ejemplar' })
  @ApiCreatedResponse({ type: CopyResponseDto })
  @ApiExtension('x-implementation-status', 'implemented')
  createCopy(
    @Param('resourceId') resourceId: string,
    @Body() dto: CreateCopyDto,
  ) {
    return this.service.createCopy(resourceId, dto);
  }

  @Get('resources/:resourceId/copies')
  @ApiOperation({ summary: 'Consultar ejemplares de un recurso' })
  @ApiOkResponse({ type: CopyResponseDto, isArray: true })
  @ApiExtension('x-implementation-status', 'implemented')
  listCopiesByResource(@Param('resourceId') resourceId: string) {
    return this.service.listCopiesByResource(resourceId);
  }

  @Get('copies/:copyId')
  @ApiOperation({ summary: 'Consultar ejemplar' })
  @ApiOkResponse({ type: CopyDetailResponseDto })
  @ApiExtension('x-implementation-status', 'implemented')
  getCopy(@Param('copyId') copyId: string) {
    return this.service.getCopy(copyId);
  }

  @Delete('copies/:copyId')
  deleteCopy(@Param('copyId') copyId: string) {
    return this.service.deleteCopy(copyId);
  }

  @Patch('copies/:copyId/state')
  @ApiBody({ type: UpdateCopyStateDto })
  @ApiOperation({ summary: 'Modificar estado de un ejemplar' })
  @ApiOkResponse({ type: CopyResponseDto })
  @ApiExtension('x-implementation-status', 'implemented')
  updateCopyState(
    @Param('copyId') copyId: string,
    @Body() dto: UpdateCopyStateDto,
  ) {
    return this.service.updateCopyState(copyId, dto);
  }

  @Get('resources/:resourceId/availability')
  @ApiOperation({ summary: 'Consultar disponibilidad de un recurso' })
  @ApiOkResponse({ type: ResourceAvailabilityResponseDto })
  @ApiExtension('x-implementation-status', 'implemented')
  getResourceAvailability(@Param('resourceId') resourceId: string) {
    return this.service.getResourceAvailability(resourceId);
  }

  @Get('availability')
  getGlobalAvailability() {
    return this.service.getGlobalAvailability();
  }

  @Post('copies/:copyId/observations')
  @ApiBody({ type: CreateCopyObservationDto })
  @ApiOperation({ summary: 'Registrar observación de un ejemplar' })
  @ApiCreatedResponse({ type: ObservationResponseDto })
  @ApiExtension('x-implementation-status', 'implemented')
  createObservation(
    @Param('copyId') copyId: string,
    @Body() dto: CreateCopyObservationDto,
  ) {
    return this.service.createObservation(copyId, dto);
  }

  @Get('copies/:copyId/observations')
  @ApiOperation({ summary: 'Consultar observaciones de un ejemplar' })
  @ApiOkResponse({ type: ObservationResponseDto, isArray: true })
  @ApiExtension('x-implementation-status', 'implemented')
  listObservationsByCopy(@Param('copyId') copyId: string) {
    return this.service.listObservationsByCopy(copyId);
  }
}
