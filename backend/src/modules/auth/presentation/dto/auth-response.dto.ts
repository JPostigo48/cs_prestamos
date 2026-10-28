import { ApiProperty } from '@nestjs/swagger';
import { AccessRole } from '../../domain/entities/access-account.js';
import { UserType } from '../../../users/domain/entities/registration-request.js';

export class AccessAccountResponseDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'uuid' }) userId!: string;
  @ApiProperty({ type: String, format: 'email' }) email!: string;
  @ApiProperty({ enum: AccessRole }) role!: AccessRole;
  @ApiProperty({ type: Boolean }) enabled!: boolean;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastAccessAt!: string | null;
}

export class AuthenticatedUserResponseDto {
  @ApiProperty({ type: String, format: 'uuid' }) id!: string;
  @ApiProperty({ type: String, format: 'email' }) email!: string;
  @ApiProperty({ enum: AccessRole }) role!: AccessRole;
  @ApiProperty({ enum: UserType }) userType!: UserType;
}

export class AuthenticationResponseDto {
  @ApiProperty({ type: String }) accessToken!: string;
  @ApiProperty({ type: String, enum: ['Bearer'] }) tokenType!: string;
  @ApiProperty({
    type: 'integer',
    description: 'Vigencia del token en segundos.',
  })
  expiresIn!: number;
  @ApiProperty({ type: AuthenticatedUserResponseDto })
  user!: AuthenticatedUserResponseDto;
}
