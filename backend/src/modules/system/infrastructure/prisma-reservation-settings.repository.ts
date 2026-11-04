import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Temporal } from 'temporal-polyfill/full';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import { instantToDate } from '../../../shared/infrastructure/prisma/instant-to-date.js';
import {
  ReservationSettingsRepository,
  type SettingsActor,
} from '../domain/reservation-settings.repository.js';
import {
  validateSettingsPatch,
  type OpeningDay,
  type ReservationSettingsPatch,
} from '../domain/reservation-settings.js';

type Runtime = Pick<ReturnType<PrismaService['client']['runtime']>, 'query'>;
export function settingsUnavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException(
    'Configuración de reservas no disponible. Solicite aplicar la migración pendiente de configuración del sistema; no se guardaron cambios.',
  );
}

/** Misma fila bloqueada por PATCH y por creación; se mantiene estable hasta commit. */
export async function readReservationSettings(
  prisma: PrismaService,
  tx: Runtime,
  lock = false,
) {
  try {
    if (lock)
      await tx.query(
        prisma.client.raw.sql`
      SELECT id FROM public.configuracion_reservas WHERE id = 1 FOR UPDATE
    `
          .returnsRow({})
          .build(),
      );
    const rows = await tx.query(
      prisma.sql.public.configuracion_reservas
        .select('pickupWaitMinutes', 'weeklySchedule', 'version', 'updatedAt')
        .where((row, f) => f.eq(row.id, 1))
        .limit(1)
        .build(),
    );
    if (!rows[0]) throw settingsUnavailable();
    const row = rows[0];
    const settings = {
      pickupWaitMinutes: row.pickupWaitMinutes,
      weeklySchedule: row.weeklySchedule as OpeningDay[] | null,
      version: row.version,
      updatedAt: instantToDate(row.updatedAt).toISOString(),
    };
    validateSettingsPatch(settings);
    return settings;
  } catch {
    // No filtrar SQL, nombres internos ni errores del driver al cliente.
    throw settingsUnavailable();
  }
}

@Injectable()
export class PrismaReservationSettingsRepository implements ReservationSettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  read() {
    return readReservationSettings(this.prisma, this.prisma.client.runtime());
  }

  async update(patch: ReservationSettingsPatch, actor: SettingsActor) {
    validateSettingsPatch(patch);
    try {
      return await this.prisma.client.transaction(async (tx) => {
        const before = await readReservationSettings(this.prisma, tx, true);
        const after = {
          ...before,
          pickupWaitMinutes:
            patch.pickupWaitMinutes ?? before.pickupWaitMinutes,
          weeklySchedule:
            patch.weeklySchedule === undefined
              ? before.weeklySchedule
              : patch.weeklySchedule,
          version: before.version + 1,
          updatedAt: new Date().toISOString(),
        };
        const rows = await tx.query(
          this.prisma.sql.public.configuracion_reservas
            .update({
              pickupWaitMinutes: after.pickupWaitMinutes,
              weeklySchedule:
                after.weeklySchedule === null
                  ? null
                  : after.weeklySchedule.map((d) => ({
                      ...d,
                      intervals: d.intervals.map((i) => ({ ...i })),
                    })),
              version: after.version,
              updatedAt: Temporal.Instant.from(after.updatedAt),
            })
            .where((r, f) => f.eq(r.id, 1))
            .returning('id')
            .build(),
        );
        if (!rows[0]) throw settingsUnavailable();
        await tx.query(
          this.prisma.sql.public.auditorias_usuario
            .insert([
              {
                usuarioId: actor.userId,
                accion: 'RESERVATION_SETTINGS_UPDATED',
                datosAnteriores: JSON.stringify(before),
                datosNuevos: JSON.stringify({ actor, settings: after }),
              },
            ])
            .returning('id')
            .build(),
        );
        return after;
      });
    } catch {
      throw settingsUnavailable();
    }
  }
}
