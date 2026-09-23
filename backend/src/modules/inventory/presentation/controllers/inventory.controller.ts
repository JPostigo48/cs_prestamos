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
import { InventoryService } from '../../application/use-cases/inventory.service.js';
import { CreateCategoryDto } from '../dto/create-category.dto.js';
import { CreateCopyDto } from '../dto/create-copy.dto.js';
import { CreateCopyObservationDto } from '../dto/create-copy-observation.dto.js';
import { CreateResourceDto } from '../dto/create-resource.dto.js';
import { UpdateCategoryDto } from '../dto/update-category.dto.js';
import { UpdateCopyStateDto } from '../dto/update-copy-state.dto.js';
import { UpdateResourceDto } from '../dto/update-resource.dto.js';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.service.createCategory(dto);
  }

  @Get('categories')
  listCategories() {
    return this.service.listCategories();
  }

  @Get('categories/:categoryId')
  getCategory(@Param('categoryId') categoryId: string) {
    return this.service.getCategory(categoryId);
  }

  @Patch('categories/:categoryId')
  updateCategory(
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.service.updateCategory(categoryId, dto);
  }

  @Delete('categories/:categoryId')
  deleteCategory(@Param('categoryId') categoryId: string) {
    return this.service.deleteCategory(categoryId);
  }

  @Post('resources')
  createResource(@Body() dto: CreateResourceDto) {
    return this.service.createResource(dto);
  }

  @Get('resources')
  listResources(
    @Query('categoryId') categoryId?: string,
    @Query('available') available?: string,
    @Query('search') search?: string,
  ) {
    return this.service.listResources({ categoryId, available, search });
  }

  @Get('resources/:resourceId')
  getResource(@Param('resourceId') resourceId: string) {
    return this.service.getResource(resourceId);
  }

  @Patch('resources/:resourceId')
  updateResource(
    @Param('resourceId') resourceId: string,
    @Body() dto: UpdateResourceDto,
  ) {
    return this.service.updateResource(resourceId, dto);
  }

  @Delete('resources/:resourceId')
  deleteResource(@Param('resourceId') resourceId: string) {
    return this.service.deleteResource(resourceId);
  }

  @Post('resources/:resourceId/copies')
  createCopy(
    @Param('resourceId') resourceId: string,
    @Body() dto: CreateCopyDto,
  ) {
    return this.service.createCopy(resourceId, dto);
  }

  @Get('resources/:resourceId/copies')
  listCopiesByResource(@Param('resourceId') resourceId: string) {
    return this.service.listCopiesByResource(resourceId);
  }

  @Get('copies/:copyId')
  getCopy(@Param('copyId') copyId: string) {
    return this.service.getCopy(copyId);
  }

  @Patch('copies/:copyId/state')
  updateCopyState(
    @Param('copyId') copyId: string,
    @Body() dto: UpdateCopyStateDto,
  ) {
    return this.service.updateCopyState(copyId, dto);
  }

  @Get('resources/:resourceId/availability')
  getResourceAvailability(@Param('resourceId') resourceId: string) {
    return this.service.getResourceAvailability(resourceId);
  }

  @Post('copies/:copyId/observations')
  createObservation(
    @Param('copyId') copyId: string,
    @Body() dto: CreateCopyObservationDto,
  ) {
    return this.service.createObservation(copyId, dto);
  }

  @Get('copies/:copyId/observations')
  listObservationsByCopy(@Param('copyId') copyId: string) {
    return this.service.listObservationsByCopy(copyId);
  }
}
