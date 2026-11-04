import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PublicPolicyResponseDto } from '../../../rules/presentation/dto/public-terms-response.dto.js';

export class ListCategoriesQueryDto {
  @ApiPropertyOptional({
    enum: ['true', 'false'],
    description: 'Omitir devuelve todas, incluidas inactivas.',
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  active?: 'true' | 'false';
}

export class CategoryPoliciesResponseDto {
  @ApiProperty({ enum: ['COMPLETE', 'INCOMPLETE', 'UNAVAILABLE'] })
  status!: string;
  @ApiProperty({ type: Boolean }) eligibleForNewOperations!: boolean;
  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  termsVersionId!: string | null;
  @ApiProperty({ type: PublicPolicyResponseDto, isArray: true })
  policies!: PublicPolicyResponseDto[];
  @ApiProperty({ type: Boolean, enum: [false] }) rulesEditable!: false;
  @ApiProperty({ type: String }) message!: string;
}

class DeletionBlockerDto {
  @ApiProperty({ type: String }) dependency!: string;
  @ApiProperty({ type: Number }) count!: number;
  @ApiProperty({ type: String }) reason!: string;
}
class DeletionCountsDto {
  @ApiProperty({ type: Number }) categories!: number;
  @ApiProperty({ type: Number }) resources!: number;
  @ApiProperty({ type: Number }) copies!: number;
  @ApiProperty({ type: Number }) accessories!: number;
}
export class CategoryDeletionPreviewDto {
  @ApiProperty({ type: String, format: 'uuid' }) categoryId!: string;
  @ApiProperty({ type: String }) nombre!: string;
  @ApiProperty({ type: String, isArray: true }) resourceIds!: string[];
  @ApiProperty({ type: String, isArray: true }) copyIds!: string[];
  @ApiProperty({ type: String, isArray: true }) accessoryIds!: string[];
  @ApiProperty({ type: Number }) resourceCount!: number;
  @ApiProperty({ type: Number }) copyCount!: number;
  @ApiProperty({ type: DeletionBlockerDto, isArray: true })
  blockers!: DeletionBlockerDto[];
  @ApiProperty({ type: Boolean }) canDelete!: boolean;
  @ApiProperty({ type: DeletionCountsDto }) wouldDelete!: DeletionCountsDto;
  @ApiProperty({ enum: ['DEACTIVATE'] }) alternative!: 'DEACTIVATE';
}
