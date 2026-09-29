import 'dotenv/config';
import 'temporal-polyfill/full/global';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from '../contract.d.ts';
import contractJson from '../contract.json' with { type: 'json' };

const prisma = postgres<Contract>({
  contractJson,
  url: process.env.DATABASE_URL!,
});

async function queryRows<T = any>(plan: unknown): Promise<T[]> {
  return (await prisma.runtime().query(plan as any)) as T[];
}

async function findUser(institutionalId: string) {
  const rows = await queryRows(prisma.sql.public.usuarios.select('id', 'nombre', 'tipoUsuario', 'identificadorInstitucional', 'vinculacionVigente', 'confianza').where((row, fns) => fns.eq(row.identificadorInstitucional, institutionalId)).limit(1).build());
  return rows[0] ?? null;
}

async function upsertUser(data: { id: string; nombre: string; tipoUsuario: 'ESTUDIANTE' | 'DOCENTE' | 'ADMINISTRATIVO'; identificadorInstitucional: string; vinculacionVigente: boolean; confianza: string }) {
  const existing = await findUser(data.identificadorInstitucional);
  if (existing) return existing;
  const rows = await queryRows(prisma.sql.public.usuarios.insert([data]).returning('id', 'nombre', 'tipoUsuario', 'identificadorInstitucional', 'vinculacionVigente', 'confianza').build());
  return rows[0];
}

async function findRequest(institutionalId: string) {
  const rows = await queryRows(prisma.sql.public.solicitudes_registro.select('id', 'nombre', 'tipoUsuario', 'identificadorInstitucional', 'estado', 'usuarioAprobadoId').where((row, fns) => fns.eq(row.identificadorInstitucional, institutionalId)).limit(1).build());
  return rows[0] ?? null;
}

async function upsertRequest(data: { nombre: string; tipoUsuario: 'ESTUDIANTE' | 'DOCENTE' | 'ADMINISTRATIVO'; identificadorInstitucional: string; estado: 'PENDIENTE' | 'APROBADA'; usuarioAprobadoId?: string | null }) {
  const existing = await findRequest(data.identificadorInstitucional);
  if (existing) return existing;
  const rows = await queryRows(prisma.sql.public.solicitudes_registro.insert([data]).returning('id', 'nombre', 'tipoUsuario', 'identificadorInstitucional', 'estado', 'usuarioAprobadoId').build());
  return rows[0];
}

async function ensureEvidence(solicitudRegistroId: string, informacion: string) {
  const existing = await queryRows(prisma.sql.public.evidencias_vinculacion.select('id').where((row, fns) => fns.eq(row.solicitudRegistroId, solicitudRegistroId)).where((row, fns) => fns.eq(row.informacion, informacion)).limit(1).build());
  if (existing[0]) return existing[0];
  const rows = await queryRows(prisma.sql.public.evidencias_vinculacion.insert([{ solicitudRegistroId, informacion }]).returning('id').build());
  return rows[0];
}

export async function seedUsers() {
  await prisma.connect();
  try {
    const approvedUser = await upsertUser({
      id: '00000000-0000-4000-8000-000000000001',
      nombre: 'Usuario Aprobado Seed',
      tipoUsuario: 'ESTUDIANTE',
      identificadorInstitucional: 'SEED-APPROVED',
      vinculacionVigente: true,
      confianza: '100.00',
    });
    const inactiveUser = await upsertUser({
      id: '00000000-0000-4000-8000-000000000002',
      nombre: 'Usuario Sin Vinculacion Seed',
      tipoUsuario: 'DOCENTE',
      identificadorInstitucional: 'SEED-INACTIVE',
      vinculacionVigente: false,
      confianza: '75.00',
    });
    const approvedRequest = await upsertRequest({
      nombre: 'Usuario Aprobado Seed',
      tipoUsuario: 'ESTUDIANTE',
      identificadorInstitucional: 'SEED-APPROVED',
      estado: 'APROBADA',
      usuarioAprobadoId: approvedUser.id,
    });
    await ensureEvidence(approvedRequest.id, 'Evidencia institucional de prueba aprobada.');
    const pendingRequest = await upsertRequest({
      nombre: 'Solicitud Pendiente Seed',
      tipoUsuario: 'ADMINISTRATIVO',
      identificadorInstitucional: 'SEED-PENDING',
      estado: 'PENDIENTE',
      usuarioAprobadoId: null,
    });
    await ensureEvidence(pendingRequest.id, 'Evidencia institucional de prueba pendiente.');
    return { approvedUser, inactiveUser, approvedRequest, pendingRequest };
  } finally {
    await prisma.close();
  }
}
