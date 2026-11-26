import { describe, expect, it, vi } from 'vitest';
import { inMemoryPrisma } from './helpers/in-memory-prisma.js';
import { PrismaRegistrationRequestRepository } from '../src/modules/users/infrastructure/persistence/prisma/prisma-registration-request.repository.js';
import { FullRegistrationUseCase } from '../src/modules/auth/application/use-cases/full-registration.use-case.js';
import { UsersRegistrationAdapter } from '../src/modules/auth/infrastructure/integration/users-registration.adapter.js';
import { SubmitRegistrationRequestUseCase } from '../src/modules/users/application/use-cases/submit-registration-request.use-case.js';
import { UserType } from '../src/modules/users/domain/entities/registration-request.js';
const termsVersionId = '123e4567-e89b-42d3-a456-426614174003';
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWP4//8/AAX+Av5Y8msOAAAAAElFTkSuQmCC';
const input = () => ({ name: ' Docente de prueba ', userType: UserType.DOCENTE, institutionalId: ' DOC-1 ', phone: ' 999123456 ', email: ' USER@UNSA.EDU.PE ', password: ' legitimate password ', termsVersionId, evidence: [image] });
describe('registration application and deterministic list, memory only', () => {
  it('full registration → adapter → submission → persistence → review without remount/special schema', async () => {
    const db = inMemoryPrisma({ versiones_terminos: [{ id: termsVersionId, numero: 1 }] });
    const repo = new PrismaRegistrationRequestRepository(db as any);
    const users = { findByInstitutionalId: vi.fn().mockResolvedValue(null) };
    const adapter = new UsersRegistrationAdapter(new SubmitRegistrationRequestUseCase(repo, users as any));
    const hash = vi.fn().mockResolvedValue('$argon2id$v=19$m=65536,t=3,p=1$c2FsdHNhbHRzYWx0c2FsdA$' + Buffer.alloc(32, 1).toString('base64').replace(/=+$/, ''));
    const full = new FullRegistrationUseCase(adapter, { hash } as any);
    const filters = { page: 1, limit: 20, status: 'PENDIENTE' as const };
    expect((await repo.list(filters)).items).toEqual([]);
    const result = await full.execute(input());
    const listing = await repo.list(filters);
    expect(listing.total).toBe(1);
    expect(listing.items[0]).toMatchObject({ id: result.id, name: 'Docente de prueba', institutionalId: 'DOC-1', phone: '999123456', approvalBlockers: [] });
    expect(hash).toHaveBeenCalledExactlyOnceWith(' legitimate password ');
    expect(db.rows('solicitudes_registro')[0].email).toBe('user@unsa.edu.pe');
    expect(JSON.stringify(listing)).not.toMatch(/passwordHash|legitimate password/);
  });
  it('orders date DESC, id DESC before paging, 45 tied rows, combined filters, empty page', async () => {
    const rows = Array.from({ length: 45 }, (_, i) => ({
      id: String(i + 1).padStart(3, '0'), nombre: 'Histórico', tipoUsuario: 'DOCENTE',
      identificadorInstitucional: 'DOC', telefono: null, fechaSolicitud: '2026-11-01T00:00:00.000Z', estado: 'RECHAZADA',
    }));
    rows.push({ ...rows[0], id: 'newer', fechaSolicitud: '2026-11-02T00:00:00.000Z' });
    rows.push({ ...rows[0], id: 'excluded-status', estado: 'APROBADA' });
    rows.push({ ...rows[0], id: 'excluded-id', identificadorInstitucional: 'OTHER' });
    const db = inMemoryPrisma({ solicitudes_registro: rows.reverse() });
    const repo = new PrismaRegistrationRequestRepository(db as any);
    const filters = { status: 'RECHAZADA' as const, institutionalId: 'DOC', limit: 20 };
    const first = await repo.list({ ...filters, page: 1 });
    const second = await repo.list({ ...filters, page: 2 });
    const third = await repo.list({ ...filters, page: 3 });
    const empty = await repo.list({ ...filters, page: 4 });
    expect(first.total).toBe(46); expect(second.total).toBe(46);
    expect(first.items.map(r => r.id)).toEqual(['newer', ...Array.from({ length: 19 }, (_, i) => String(45 - i).padStart(3, '0'))]);
    expect(second.items.map(r => r.id)).toEqual(Array.from({ length: 20 }, (_, i) => String(26 - i).padStart(3, '0')));
    expect(third.items.map(r => r.id)).toEqual(['006', '005', '004', '003', '002', '001']);
    expect(empty.items).toEqual([]); expect(empty.total).toBe(46);
    expect(db.calls.filter(c => c.table === 'solicitudes_registro')).toHaveLength(4);
    expect(db.calls[0].text).toContain('ORDER BY r."fechaSolicitud" DESC, r.id DESC');
    expect(db.calls[0].values).toEqual(['RECHAZADA', 'DOC', 20, 0]);
    expect(db.calls.filter(c => c.table === 'solicitudes_registro').map(c => c.values?.[3])).toEqual([0, 20, 40, 60]);
    expect(db.calls.every(c => c.operation === 'select')).toBe(true);
    expect(rows.some(r => r.telefono !== null)).toBe(false);
  });
  it.each(['name', 'institutionalId', 'phone', 'email', 'password', 'userType', 'termsVersionId', 'evidence'])('direct full use case rejects %s without writes or hash', async key => {
    const submit = vi.fn(), hash = vi.fn();
    const useCase = new FullRegistrationUseCase({ submit }, { hash } as any);
    for (const value of [undefined, null, '', '   ']) {
      await expect(useCase.execute({ ...input(), [key]: value } as any)).rejects.toMatchObject({ status: 400 });
    }
    expect(submit).not.toHaveBeenCalled(); expect(hash).not.toHaveBeenCalled();
  });
  it.each(['name', 'institutionalId', 'phone', 'userType', 'evidence'])('direct submission rejects invalid %s before repository access', async key => {
    const create = vi.fn(), findByInstitutionalId = vi.fn();
    const useCase = new SubmitRegistrationRequestUseCase({ create } as any, { findByInstitutionalId } as any);
    for (const value of [undefined, null, '', '   ']) await expect(useCase.execute({ ...input(), [key]: value } as any)).rejects.toMatchObject({ status: 400 });
    expect(create).not.toHaveBeenCalled(); expect(findByInstitutionalId).not.toHaveBeenCalled();
  });
});
