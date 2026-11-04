import type {
  ReservationSettings,
  ReservationSettingsPatch,
} from './reservation-settings.js';

export interface SettingsActor {
  accountId: string;
  userId: string;
}
export abstract class ReservationSettingsRepository {
  abstract read(): Promise<ReservationSettings>;
  abstract update(
    patch: ReservationSettingsPatch,
    actor: SettingsActor,
  ): Promise<ReservationSettings>;
}
