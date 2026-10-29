import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

export class GoogleAuthorizationDto {
  @ApiProperty({
    type: String,
    format: 'email',
    description: 'Sugerencia de cuenta; nunca prueba de identidad.',
  })
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
export class GoogleExchangeDto {
  @ApiProperty({
    type: String,
    description: 'Código de autorización devuelto por Google, de un solo uso.',
  })
  @IsString()
  @Length(1, 4096)
  code!: string;
  @ApiProperty({
    type: String,
    description:
      'State opaco devuelto por Google. Requiere cookie HttpOnly de inicio.',
  })
  @IsString()
  @Length(43, 43)
  state!: string;
}
export class GoogleAuthorizationResponseDto {
  @ApiProperty({
    type: String,
    format: 'uri',
    description: 'URL HTTPS de Google; no inicia una sesión de aplicación.',
  })
  authorizationUrl!: string;
}
