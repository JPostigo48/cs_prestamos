import { ForbiddenException, Injectable } from '@nestjs/common';
import { LoanRepository } from '../../domain/repositories/loan.repository.js';
import { ReservationRepository } from '../../domain/repositories/reservation.repository.js';
import type {
  ReservationsQuery,
  ResourceHistoryQuery,
  SaveReturnChecklistData,
} from '../../domain/repositories/loan-queries.js';
import type { AuthenticatedIdentity } from '../../../auth/application/ports/auth.inputs.js';
import { AccessRole } from '../../../auth/domain/entities/access-account.js';

@Injectable()
export class ListResourceHistoryUseCase {
  constructor(private readonly loans: LoanRepository) {}
  execute(resourceId: string, query: ResourceHistoryQuery) {
    return this.loans.findResourceHistory(resourceId, query);
  }
}

@Injectable()
export class ListReservationsUseCase {
  constructor(private readonly reservations: ReservationRepository) {}
  execute(query: ReservationsQuery, actor: AuthenticatedIdentity) {
    if (actor.role === AccessRole.USER) {
      if (query.userId && query.userId !== actor.userId)
        throw new ForbiddenException('Solo puede consultar sus reservas.');
      query = { ...query, userId: actor.userId };
    }
    return this.reservations.findMany(query);
  }
}

@Injectable()
export class SaveReturnChecklistUseCase {
  constructor(private readonly loans: LoanRepository) {}
  execute(input: SaveReturnChecklistData) {
    return this.loans.saveReturnChecklist(input);
  }
}
