import 'dotenv/config';
import 'temporal-polyfill/full/global';
import argon2 from 'argon2';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from '../contract.d.ts';
import contractJson from '../contract.json' with { type: 'json' };

const prisma = postgres<Contract>({
  contractJson,
  url: process.env.DATABASE_URL!,
});

type Role = 'USUARIO' | 'OPERADOR' | 'ADMINISTRADOR';

async function queryRows<T = any>(plan: unknown): Promise<T[]> {
  return (await prisma.runtime().query(plan as any)) as T[];
}

async function findUser(institutionalId: string) {
  const rows = await queryRows(
    prisma.sql.public.usuarios
      .select('id', 'vinculacionVigente')
      .where((row, fns) => fns.eq(row.identificadorInstitucional, institutionalId))
      .limit(1)
      .build(),
  );
  return rows[0] ?? null;
}

async function findAccount(userId: string, email: string) {
  const rows = await queryRows(
    prisma.sql.public.cuentas_acceso
      .select('id', 'usuarioId', 'email', 'rol', 'habilitada')
      .where((row, fns) => fns.eq(row.usuarioId, userId))
      .limit(1)
      .build(),
  );
  const byUser = rows[0] ?? null;
  if (byUser) return byUser;

  const byEmail = await queryRows(
    prisma.sql.public.cuentas_acceso
      .select('id', 'usuarioId', 'email', 'rol', 'habilitada')
      .where((row, fns) => fns.eq(row.email, email))
      .limit(1)
      .build(),
  );
  return byEmail[0] ?? null;
}

async function ensureAccount(input: {
  institutionalId: string;
  email: string;
  password: string;
  role: Role;
}) {
  const user = await findUser(input.institutionalId);
  if (!user) {
    throw new Error(`No existe el usuario seed ${input.institutionalId}.`);
  }
  if (!user.vinculacionVigente) {
    throw new Error(`El usuario seed ${input.institutionalId} no está vigente.`);
  }

  const existing = await findAccount(user.id, input.email);
  if (existing) {
    if (existing.usuarioId !== user.id) {
      throw new Error(`El correo seed ${input.email} pertenece a otra cuenta.`);
    }
    return { ...existing, created: false };
  }

  const passwordHash = await argon2.hash(input.password, {
    type: argon2.argon2id,
  });
  const rows = await queryRows(
    prisma.sql.public.cuentas_acceso
      .insert([{
        usuarioId: user.id,
        email: input.email,
        passwordHash,
        rol: input.role,
        habilitada: true,
      }])
      .returning('id', 'usuarioId', 'email', 'rol', 'habilitada')
      .build(),
  );
  return { ...rows[0], created: true };
}

export async function seedAuth() {
  await prisma.connect();
  try {
    const accounts = await Promise.all([
      ensureAccount({
        institutionalId: 'SEED-APPROVED',
        email: 'seed.usuario@unsa.edu.pe',
        password: 'SeedUsuario-2026!',
        role: 'USUARIO',
      }),
      ensureAccount({
        institutionalId: 'SEED-OPERATOR',
        email: 'seed.operador@unsa.edu.pe',
        password: 'SeedOperador-2026!',
        role: 'OPERADOR',
      }),
      ensureAccount({
        institutionalId: 'SEED-ADMIN',
        email: 'seed.admin@unsa.edu.pe',
        password: 'SeedAdministrador-2026!',
        role: 'ADMINISTRADOR',
      }),
    ]);
    console.log(
      `Auth seed: ${accounts.filter((account) => account.created).length} cuentas creadas, ` +
        `${accounts.filter((account) => !account.created).length} cuentas conservadas.`,
    );
    return accounts;
  } finally {
    await prisma.close();
  }
}
