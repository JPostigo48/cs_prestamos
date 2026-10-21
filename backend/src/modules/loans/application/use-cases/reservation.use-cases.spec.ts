import { ConflictException, BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { CreateReservationUseCase } from './create-reservation.use-case.js';
import { PickupReservationUseCase } from './pickup-reservation.use-case.js';
import { CancelReservationUseCase } from './cancel-reservation.use-case.js';

const requestedAt = new Date(Date.now() + 60 * 60 * 1000);

const reservation = {
  id: 'reservation-1',
  userId: 'user-1',
  copyId: 'copy-1',
  requestedAt,
  pickupDeadline: new Date(requestedAt.getTime() + 30 * 60 * 1000),
  pickedUpAt: null,
  cancelledAt: null,
  status: 'CONFIRMADA' as const,
  cancellationReason: null,
  loanId: null,
};

describe('Reservation use cases', () => {
  it('creates a reservation for an available copy', async () => {
    const reservations = {
      hasOpenReservationOrLoan: vi.fn().mockResolvedValue(false),
      create: vi.fn().mockResolvedValue(reservation),
    };
    const useCase = new CreateReservationUseCase(
      reservations as any,
      { getByUserId: vi.fn().mockResolvedValue({
        userId: 'user-1',
        enabled: true,
        institutionalType: 'ESTUDIANTE',
      }) } as any,
      { getAvailability: vi.fn().mockResolvedValue({ available: true }) } as any,
      { hasAcceptedCurrentVersion: vi.fn().mockResolvedValue(true) } as any,
    );

    await expect(useCase.execute({
      userId: 'user-1',
      copyId: 'copy-1',
      requestedAt,
    })).resolves.toEqual(reservation);
    expect(reservations.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      copyId: 'copy-1',
      pickupDeadline: reservation.pickupDeadline,
    }));
  });

  it('rejects past reservations and a second open operation for students', async () => {
    const reservations = {
      hasOpenReservationOrLoan: vi.fn().mockResolvedValue(true),
      create: vi.fn(),
    };
    const useCase = new CreateReservationUseCase(
      reservations as any,
      { getByUserId: vi.fn().mockResolvedValue({
        userId: 'user-1',
        enabled: true,
        institutionalType: 'ESTUDIANTE',
      }) } as any,
      { getAvailability: vi.fn().mockResolvedValue({ available: true }) } as any,
      { hasAcceptedCurrentVersion: vi.fn().mockResolvedValue(true) } as any,
    );

    await expect(useCase.execute({
      userId: 'user-1',
      copyId: 'copy-1',
      requestedAt,
    })).rejects.toThrow(ConflictException);

    const noOpenOperation = new CreateReservationUseCase(
      { hasOpenReservationOrLoan: vi.fn().mockResolvedValue(false), create: vi.fn() } as any,
      { getByUserId: vi.fn().mockResolvedValue({ userId: 'user-1', enabled: true, institutionalType: 'ESTUDIANTE' }) } as any,
      { getAvailability: vi.fn().mockResolvedValue({ available: true }) } as any,
      { hasAcceptedCurrentVersion: vi.fn().mockResolvedValue(true) } as any,
    );
    await expect(noOpenOperation.execute({
      userId: 'user-1',
      copyId: 'copy-1',
      requestedAt: new Date(Date.now() - 1),
    })).rejects.toThrow(BadRequestException);
  });

  it('allows multiple open operations for docentes', async () => {
    const reservations = {
      hasOpenReservationOrLoan: vi.fn(),
      create: vi.fn().mockResolvedValue(reservation),
    };
    const useCase = new CreateReservationUseCase(
      reservations as any,
      { getByUserId: vi.fn().mockResolvedValue({ userId: 'user-1', enabled: true, institutionalType: 'DOCENTE' }) } as any,
      { getAvailability: vi.fn().mockResolvedValue({ available: true }) } as any,
      { hasAcceptedCurrentVersion: vi.fn().mockResolvedValue(true) } as any,
    );

    await expect(useCase.execute({ userId: 'user-1', copyId: 'copy-1', requestedAt })).resolves.toEqual(reservation);
    expect(reservations.hasOpenReservationOrLoan).not.toHaveBeenCalled();
  });

  it('requires pickup inside the reservation window', async () => {
    const reservations = {
      findById: vi.fn().mockResolvedValue(reservation),
      pickup: vi.fn().mockResolvedValue({ reservation, loan: { id: 'loan-1' } }),
    };
    const useCase = new PickupReservationUseCase(reservations as any);

    await expect(useCase.execute({
      reservationId: reservation.id,
      pickedUpAt: new Date(reservation.pickupDeadline.getTime() + 1),
    })).rejects.toThrow(ConflictException);

    await expect(useCase.execute({
      reservationId: reservation.id,
      pickedUpAt: reservation.pickupDeadline,
    })).resolves.toEqual({ id: 'loan-1' });
  });

  it('only allows the owner to cancel a confirmed reservation', async () => {
    const reservations = {
      findById: vi.fn().mockResolvedValue(reservation),
      cancel: vi.fn().mockResolvedValue({ ...reservation, status: 'CANCELADA' }),
    };
    const useCase = new CancelReservationUseCase(reservations as any);

    await expect(useCase.execute({
      reservationId: reservation.id,
      userId: 'other-user',
    })).rejects.toThrow(ConflictException);

    await expect(useCase.execute({
      reservationId: reservation.id,
      userId: reservation.userId,
      reason: 'Ya no necesito el ejemplar',
    })).resolves.toMatchObject({ status: 'CANCELADA' });
  });
});
