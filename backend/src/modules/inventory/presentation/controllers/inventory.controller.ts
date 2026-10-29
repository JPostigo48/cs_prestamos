import { ApiHttpErrors } from '../../../../shared/presentation/openapi/api-http-errors.decorator.js';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AccessRole } from '../../../auth/domain/entities/access-account.js';
import { AuthGuard } from '../../../auth/presentation/guards/auth.guard.js';
import { RolesGuard } from '../../../auth/presentation/guards/roles.guard.js';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator.js';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator.js';
import type { AuthenticatedIdentity } from '../../../auth/application/ports/auth.inputs.js';
import { UpdateCopyDto } from '../dto/update-copy.dto.js';
import {
  ApiBody,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiExtension,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
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
  ReplaceResourceAccessoriesDto,
  ResourceAccessoriesResponseDto,
  ResourceLoanPolicyResponseDto,
  UpdateResourceLoanPolicyDto,
} from '../dto/resource-configuration.dto.js';
import {
  CategoryResponseDto,
  ResourcesPageResponseDto,
  GlobalAvailabilityResponseDto,
  CopyDetailResponseDto,
  CopyResponseDto,
  DeletedCategoryResponseDto,
  DeletedResourceResponseDto,
  DeactivatedCopyResponseDto,
  ObservationResponseDto,
  ResourceAvailabilityResponseDto,
  ResourceDetailResponseDto,
  ResourceResponseDto,
} from '../dto/inventory-response.dto.js';

@ApiTags('Inventario')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  @Get('resources/:resourceId/accessories')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(AccessRole.USER, AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiParam({
    name: 'resourceId',
    type: String,
    format: 'uuid',
    description: 'ID del artículo (Recurso), no del ejemplar.',
  })
  @ApiOperation({ summary: 'F06: consultar accesorios activos del artículo' })
  @ApiOkResponse({ type: ResourceAccessoriesResponseDto })
  @ApiHttpErrors(400, 401, 403, 404, 500)
  @ApiExtension('x-implementation-status', 'implemented')
  getAccessories(@Param('resourceId', new ParseUUIDPipe()) resourceId: string) {
    return this.service.getAccessories(resourceId);
  }

  @Put('resources/:resourceId/accessories')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(AccessRole.ADMINISTRATOR)
  @ApiParam({
    name: 'resourceId',
    type: String,
    format: 'uuid',
    description: 'ID del artículo, compartido por sus ejemplares.',
  })
  @ApiBody({ type: ReplaceResourceAccessoriesDto })
  @ApiOperation({
    summary:
      'F07: reemplazar plantilla de accesorios sin borrar referencias históricas',
  })
  @ApiOkResponse({ type: ResourceAccessoriesResponseDto })
  @ApiHttpErrors(400, 401, 403, 404, 409, 500)
  @ApiExtension('x-implementation-status', 'implemented')
  replaceAccessories(
    @Param('resourceId', new ParseUUIDPipe()) resourceId: string,
    @Body() dto: ReplaceResourceAccessoriesDto,
    @CurrentUser() actor: AuthenticatedIdentity,
  ) {
    return this.service.mutate(
      actor,
      'INVENTARIO_ACCESORIOS_EDITADOS',
      (service) => service.replaceAccessories(resourceId, dto.items),
    );
  }

  @Patch('resources/:resourceId/loan-policy')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(AccessRole.ADMINISTRATOR)
  @ApiParam({
    name: 'resourceId',
    type: String,
    format: 'uuid',
    description: 'ID del artículo; no modifica la categoría.',
  })
  @ApiBody({ type: UpdateResourceLoanPolicyDto })
  @ApiOperation({
    summary: 'F13: establecer o retirar duración individual del artículo',
    description:
      'No aplica porcentajes ni cambia reglas versionadas. Las reservas/préstamos existentes conservan sus fechas y duración congelada. GET del recurso expone loanPolicy.',
  })
  @ApiOkResponse({ type: ResourceLoanPolicyResponseDto })
  @ApiHttpErrors(400, 401, 403, 404, 409, 500)
  @ApiExtension('x-implementation-status', 'implemented')
  updateLoanPolicy(
    @Param('resourceId', new ParseUUIDPipe()) resourceId: string,
    @Body() dto: UpdateResourceLoanPolicyDto,
    @CurrentUser() actor: AuthenticatedIdentity,
  ) {
    return this.service.mutate(
      actor,
      'INVENTARIO_DURACION_EDITADA',
      (service) => service.updateLoanPolicy(resourceId, dto.durationHours),
    );
  }

  @ApiHttpErrors(400, 409, 500)
  @Post('categories')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiBody({ type: CreateCategoryDto })
  @ApiOperation({ summary: 'Registrar categoría de recurso' })
  @ApiCreatedResponse({ type: CategoryResponseDto })
  @ApiExtension('x-implementation-status', 'implemented')
  createCategory(
    @Body() dto: CreateCategoryDto,
    @CurrentUser() actor: AuthenticatedIdentity,
  ) {
    return this.service.mutate(
      actor,
      'INVENTARIO_CATEGORIA_CREADA',
      (service) => service.createCategory(dto),
    );
  }

  @Get('categories')
  @ApiOperation({ summary: 'Consultar categorías de recurso' })
  @ApiOkResponse({ type: CategoryResponseDto, isArray: true })
  @ApiExtension('x-implementation-status', 'implemented')
  listCategories() {
    return this.service.listCategories();
  }

  @ApiHttpErrors(400, 404)
  @Get('categories/:categoryId')
  @ApiOperation({ summary: 'Consultar categoría de recurso' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiExtension('x-implementation-status', 'implemented')
  getCategory(@Param('categoryId') categoryId: string) {
    return this.service.getCategory(categoryId);
  }

  @ApiHttpErrors(400, 404, 409)
  @Patch('categories/:categoryId')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiBody({ type: UpdateCategoryDto })
  @ApiOperation({ summary: 'Modificar categoría de recurso' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiExtension('x-implementation-status', 'implemented')
  updateCategory(
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() actor: AuthenticatedIdentity,
  ) {
    return this.service.mutate(
      actor,
      'INVENTARIO_CATEGORIA_EDITADA',
      (service) => service.updateCategory(categoryId, dto),
    );
  }

  @ApiHttpErrors(400, 404, 409)
  @Delete('categories/:categoryId')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiOperation({ summary: 'Eliminar categoría de recurso' })
  @ApiOkResponse({ type: DeletedCategoryResponseDto })
  @ApiExtension('x-implementation-status', 'implemented')
  deleteCategory(
    @Param('categoryId') categoryId: string,
    @CurrentUser() actor: AuthenticatedIdentity,
  ) {
    return this.service.mutate(
      actor,
      'INVENTARIO_CATEGORIA_ELIMINADA',
      (service) => service.deleteCategory(categoryId),
    );
  }

  @ApiHttpErrors(400, 404, 409, 500)
  @Post('resources')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiBody({ type: CreateResourceDto })
  @ApiOperation({ summary: 'Registrar recurso' })
  @ApiCreatedResponse({ type: ResourceResponseDto })
  @ApiExtension('x-implementation-status', 'implemented')
  createResource(
    @Body() dto: CreateResourceDto,
    @CurrentUser() actor: AuthenticatedIdentity,
  ) {
    return this.service.mutate(actor, 'INVENTARIO_RECURSO_CREADO', (service) =>
      service.createResource(dto),
    );
  }

  @ApiHttpErrors(400)
  @Get('resources')
  @ApiQuery({
    name: 'categoryId',
    required: false,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiQuery({
    name: 'available',
    required: false,
    schema: { type: 'string', enum: ['true', 'false', '1', '0'] },
    description:
      'Solo true filtra disponibles; false, 1 y 0 filtran no disponibles.',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    schema: { type: 'string', maxLength: 120 },
  })
  @ApiOperation({ summary: 'Consultar recursos' })
  @ApiOkResponse({ type: ResourcesPageResponseDto })
  @ApiQuery({
    name: 'page',
    required: false,
    schema: { type: 'integer', minimum: 1, default: 1 },
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  })
  @ApiExtension('x-implementation-status', 'implemented')
  listResources(@Query() query: ListResourcesQueryDto) {
    return this.service.listResources(query);
  }

  @ApiHttpErrors(400, 404, 409)
  @Get('resources/:resourceId')
  @ApiOperation({ summary: 'Consultar recurso' })
  @ApiOkResponse({ type: ResourceDetailResponseDto })
  @ApiExtension('x-implementation-status', 'implemented')
  getResource(@Param('resourceId') resourceId: string) {
    return this.service.getResource(resourceId);
  }

  @ApiHttpErrors(400, 404, 409, 500)
  @Patch('resources/:resourceId')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiBody({ type: UpdateResourceDto })
  @ApiOperation({ summary: 'Modificar recurso' })
  @ApiOkResponse({ type: ResourceResponseDto })
  @ApiExtension('x-implementation-status', 'implemented')
  updateResource(
    @Param('resourceId') resourceId: string,
    @Body() dto: UpdateResourceDto,
    @CurrentUser() actor: AuthenticatedIdentity,
  ) {
    return this.service.mutate(actor, 'INVENTARIO_RECURSO_EDITADO', (service) =>
      service.updateResource(resourceId, dto),
    );
  }

  @ApiHttpErrors(400, 404, 409)
  @Delete('resources/:resourceId')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiOperation({ summary: 'Eliminar recurso' })
  @ApiOkResponse({ type: DeletedResourceResponseDto })
  @ApiExtension('x-implementation-status', 'implemented')
  deleteResource(
    @Param('resourceId') resourceId: string,
    @CurrentUser() actor: AuthenticatedIdentity,
  ) {
    return this.service.mutate(
      actor,
      'INVENTARIO_RECURSO_ELIMINADO',
      (service) => service.deleteResource(resourceId),
    );
  }

  @ApiHttpErrors(400, 404, 409)
  @Post('resources/:resourceId/copies')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiBody({ type: CreateCopyDto })
  @ApiOperation({ summary: 'Registrar ejemplar' })
  @ApiCreatedResponse({ type: CopyResponseDto })
  @ApiExtension('x-implementation-status', 'implemented')
  createCopy(
    @Param('resourceId') resourceId: string,
    @Body() dto: CreateCopyDto,
    @CurrentUser() actor: AuthenticatedIdentity,
  ) {
    return this.service.mutate(actor, 'INVENTARIO_EJEMPLAR_CREADO', (service) =>
      service.createCopy(resourceId, dto),
    );
  }

  @ApiHttpErrors(400, 404)
  @Get('resources/:resourceId/copies')
  @ApiOperation({ summary: 'Consultar ejemplares de un recurso' })
  @ApiOkResponse({ type: CopyResponseDto, isArray: true })
  @ApiExtension('x-implementation-status', 'implemented')
  listCopiesByResource(@Param('resourceId') resourceId: string) {
    return this.service.listCopiesByResource(resourceId);
  }

  @ApiHttpErrors(400, 404)
  @Get('copies/:copyId')
  @ApiOperation({ summary: 'Consultar ejemplar' })
  @ApiOkResponse({ type: CopyDetailResponseDto })
  @ApiExtension('x-implementation-status', 'implemented')
  getCopy(@Param('copyId') copyId: string) {
    return this.service.getCopy(copyId);
  }

  @ApiHttpErrors(400, 404, 409)
  @Delete('copies/:copyId')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiOperation({
    summary:
      'Desactivar ejemplar sin borrar historial; rechaza operaciones abiertas',
  })
  @ApiOkResponse({ type: DeactivatedCopyResponseDto })
  @ApiExtension('x-implementation-status', 'implemented')
  deleteCopy(
    @Param('copyId') copyId: string,
    @CurrentUser() actor: AuthenticatedIdentity,
  ) {
    return this.service.mutate(
      actor,
      'INVENTARIO_EJEMPLAR_DESACTIVADO',
      (service) => service.deleteCopy(copyId),
    );
  }

  @ApiHttpErrors(400, 404, 409)
  @Patch('copies/:copyId')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiBody({ type: UpdateCopyDto })
  @ApiOkResponse({ type: CopyResponseDto })
  @ApiOperation({
    summary: 'Editar código de inventario sin alterar sus relaciones',
  })
  updateCopy(
    @Param('copyId') copyId: string,
    @Body() dto: UpdateCopyDto,
    @CurrentUser() actor: AuthenticatedIdentity,
  ) {
    return this.service.mutate(
      actor,
      'INVENTARIO_EJEMPLAR_EDITADO',
      (service) => service.updateCopy(copyId, dto),
    );
  }

  @ApiHttpErrors(400, 404, 409, 422)
  @Patch('copies/:copyId/state')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiBody({ type: UpdateCopyStateDto })
  @ApiOperation({ summary: 'Modificar estado de un ejemplar' })
  @ApiOkResponse({ type: CopyResponseDto })
  @ApiExtension('x-implementation-status', 'implemented')
  updateCopyState(
    @Param('copyId') copyId: string,
    @Body() dto: UpdateCopyStateDto,
    @CurrentUser() actor: AuthenticatedIdentity,
  ) {
    return this.service.mutate(actor, 'INVENTARIO_ESTADO_EDITADO', (service) =>
      service.updateCopyState(copyId, dto),
    );
  }

  @ApiHttpErrors(400, 404)
  @Get('resources/:resourceId/availability')
  @ApiOperation({ summary: 'Consultar disponibilidad de un recurso' })
  @ApiOkResponse({ type: ResourceAvailabilityResponseDto })
  @ApiExtension('x-implementation-status', 'implemented')
  getResourceAvailability(@Param('resourceId') resourceId: string) {
    return this.service.getResourceAvailability(resourceId);
  }

  @Get('availability')
  @ApiOkResponse({ type: [GlobalAvailabilityResponseDto] })
  @ApiExtension('x-implementation-status', 'implemented')
  getGlobalAvailability() {
    return this.service.getGlobalAvailability();
  }

  @ApiHttpErrors(400, 404)
  @Post('copies/:copyId/observations')
  @ApiBearerAuth()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(AccessRole.OPERATOR, AccessRole.ADMINISTRATOR)
  @ApiBody({ type: CreateCopyObservationDto })
  @ApiOperation({ summary: 'Registrar observación de un ejemplar' })
  @ApiCreatedResponse({ type: ObservationResponseDto })
  @ApiExtension('x-implementation-status', 'implemented')
  createObservation(
    @Param('copyId') copyId: string,
    @Body() dto: CreateCopyObservationDto,
    @CurrentUser() actor: AuthenticatedIdentity,
  ) {
    return this.service.mutate(
      actor,
      'INVENTARIO_OBSERVACION_CREADA',
      (service) => service.createObservation(copyId, dto),
    );
  }

  @ApiHttpErrors(400, 404)
  @Get('copies/:copyId/observations')
  @ApiOperation({ summary: 'Consultar observaciones de un ejemplar' })
  @ApiOkResponse({ type: ObservationResponseDto, isArray: true })
  @ApiExtension('x-implementation-status', 'implemented')
  listObservationsByCopy(@Param('copyId') copyId: string) {
    return this.service.listObservationsByCopy(copyId);
  }
}
