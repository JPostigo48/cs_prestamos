import { BadRequestException } from '@nestjs/common';
import { UserType } from '../entities/registration-request.js';

/** New submissions only: historical nullable records remain readable. */
export function registrationFields(input: {
  name?: unknown; institutionalId?: unknown; phone?: unknown; userType?: unknown;
}) {
  const fields = { name: '', institutionalId: '', phone: '' };
  const errors: string[] = [];
  for (const [key, min, max] of [
    ['name', 2, 180], ['institutionalId', 1, 80], ['phone', 1, 20],
  ] as const) {
    const value = input[key];
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (normalized.length < min || normalized.length > max)
      errors.push(`${key} es obligatorio y debe tener entre ${min} y ${max} caracteres.`);
    fields[key] = normalized;
  }
  if (!Object.values(UserType).includes(input.userType as UserType))
    errors.push('userType es obligatorio y debe ser un tipo institucional válido.');
  if (errors.length) throw new BadRequestException(errors);
  return fields;
}
