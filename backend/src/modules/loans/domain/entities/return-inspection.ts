import { BadRequestException } from '@nestjs/common';
import type { CopyLoanSnapshot } from '../../../inventory/domain/entities/resource-configuration.js';
import type { ReturnChecklistPart } from './loan.js';

export function inspectionParts(
  snapshot: CopyLoanSnapshot | null,
  input: { accessoryId: string; received: boolean }[],
): ReturnChecklistPart[] {
  const accessories = snapshot?.accessories ?? [];
  if (
    !Array.isArray(input) ||
    input.length !== accessories.length ||
    new Set(input.map((p) => p.accessoryId)).size !== input.length ||
    input.some(
      (p) =>
        typeof p.received !== 'boolean' ||
        !accessories.some((a) => a.id === p.accessoryId),
    )
  )
    throw new BadRequestException(
      'Inspeccione todos los accesorios del snapshot, sin omisiones ni duplicados. Sin snapshot histórico solo se admite una captura vacía.',
    );
  return accessories
    .map((a) => ({
      accessoryId: a.id,
      nombre: a.nombre,
      received: input.find((p) => p.accessoryId === a.id)!.received,
    }))
    .sort((a, b) => a.accessoryId.localeCompare(b.accessoryId));
}
