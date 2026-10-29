import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { AccessAccountResponseDto } from './auth-response.dto.js';

export class ListAccountsDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    description:
      'Usuario exacto cuya cuenta se desea consultar. Obligatorio; no expone un directorio global.',
  })
  @IsUUID()
  userId!: string;
}
export class AccountsResponseDto {
  @ApiProperty({
    type: [AccessAccountResponseDto],
    description: 'Cero o una cuenta; nunca contiene credenciales.',
  })
  items!: AccessAccountResponseDto[];
}
