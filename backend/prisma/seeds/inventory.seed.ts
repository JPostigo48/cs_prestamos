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

async function findCategoryByName(nombre: string) {
  const sql = prisma.sql.public.categorias_recurso
    .select('id', 'nombre', 'tiempoMaximoPrestamoDias')
    .where((row, fns) => fns.eq(row.nombre, nombre))
    .limit(1)
    .build();

  const rows = await queryRows(sql);
  return rows[0] ?? null;
}

async function upsertCategory(
  nombre: string,
  tiempoMaximoPrestamoDias: number,
) {
  const existing = await findCategoryByName(nombre);
  if (existing) {
    return existing;
  }

  const sql = prisma.sql.public.categorias_recurso
    .insert([
      {
        nombre,
        tiempoMaximoPrestamoDias,
      },
    ])
    .returning('id', 'nombre', 'tiempoMaximoPrestamoDias')
    .build();

  const rows = await queryRows(sql);
  return rows[0];
}

async function findResourceByName(categoriaId: string, nombre: string) {
  const sql = prisma.sql.public.recursos
    .select('id', 'categoriaId', 'nombre', 'descripcion')
    .where((row, fns) => fns.eq(row.categoriaId, categoriaId))
    .where((row, fns) => fns.eq(row.nombre, nombre))
    .limit(1)
    .build();

  const rows = await queryRows(sql);
  return rows[0] ?? null;
}

async function upsertResource(
  categoriaId: string,
  nombre: string,
  descripcion: string,
) {
  const existing = await findResourceByName(categoriaId, nombre);
  if (existing) {
    return existing;
  }

  const sql = prisma.sql.public.recursos
    .insert([
      {
        categoriaId,
        nombre,
        descripcion,
      },
    ])
    .returning('id', 'categoriaId', 'nombre', 'descripcion')
    .build();

  const rows = await queryRows(sql);
  return rows[0];
}

async function findCopyByCode(codigoInventario: string) {
  const sql = prisma.sql.public.ejemplares
    .select('id', 'recursoId', 'codigoInventario', 'estado')
    .where((row, fns) => fns.eq(row.codigoInventario, codigoInventario))
    .limit(1)
    .build();

  const rows = await queryRows(sql);
  return rows[0] ?? null;
}

async function upsertCopy(
  recursoId: string,
  codigoInventario: string,
  estado: 'DISPONIBLE' | 'NO_DISPONIBLE',
) {
  const existing = await findCopyByCode(codigoInventario);
  if (existing) {
    return existing;
  }

  const sql = prisma.sql.public.ejemplares
    .insert([
      {
        recursoId,
        codigoInventario,
        estado,
      },
    ])
    .returning('id', 'recursoId', 'codigoInventario', 'estado')
    .build();

  const rows = await queryRows(sql);
  return rows[0];
}

async function findObservation(ejemplarId: string, descripcion: string) {
  const sql = prisma.sql.public.observaciones_ejemplar
    .select('id', 'ejemplarId', 'descripcion', 'fecha')
    .where((row, fns) => fns.eq(row.ejemplarId, ejemplarId))
    .where((row, fns) => fns.eq(row.descripcion, descripcion))
    .limit(1)
    .build();

  const rows = await queryRows(sql);
  return rows[0] ?? null;
}

async function upsertObservation(ejemplarId: string, descripcion: string) {
  const existing = await findObservation(ejemplarId, descripcion);
  if (existing) {
    return existing;
  }

  const sql = prisma.sql.public.observaciones_ejemplar
    .insert([
      {
        ejemplarId,
        descripcion,
      },
    ])
    .returning('id', 'ejemplarId', 'descripcion', 'fecha')
    .build();

  const rows = await queryRows(sql);
  return rows[0];
}

export async function seedInventory() {
  await prisma.connect();

  try {
    const categorias = [
      { nombre: 'Libros', tiempoMaximoPrestamoDias: 14 },
      { nombre: 'Revistas', tiempoMaximoPrestamoDias: 7 },
      { nombre: 'Tesis', tiempoMaximoPrestamoDias: 21 },
    ];

    const categoriaMap = new Map<string, any>();
    for (const item of categorias) {
      const categoria = await upsertCategory(
        item.nombre,
        item.tiempoMaximoPrestamoDias,
      );
      categoriaMap.set(item.nombre, categoria);
    }

    const recursos = [
      {
        categoria: 'Libros',
        nombre: 'Clean Code',
        descripcion:
          'Libro de referencia sobre calidad y legibilidad del código.',
      },
      {
        categoria: 'Libros',
        nombre: 'Patrones de Diseño',
        descripcion: 'Guía práctica de diseño orientado a objetos.',
      },
      {
        categoria: 'Revistas',
        nombre: 'IEEE Software',
        descripcion: 'Revista técnica con artículos de ingeniería de software.',
      },
      {
        categoria: 'Tesis',
        nombre: 'Metodología de Investigación',
        descripcion: 'Material académico de apoyo para investigación aplicada.',
      },
    ];

    const resourceMap = new Map<string, any>();
    for (const item of recursos) {
      const categoria = categoriaMap.get(item.categoria);
      if (!categoria) continue;

      const resource = await upsertResource(
        categoria.id,
        item.nombre,
        item.descripcion,
      );
      resourceMap.set(`${item.categoria}:${item.nombre}`, resource);
    }

    const copySeed = [
      { key: 'Libros:Clean Code', codigo: 'CC-001', estado: 'DISPONIBLE' },
      { key: 'Libros:Clean Code', codigo: 'CC-002', estado: 'NO_DISPONIBLE' },
      {
        key: 'Libros:Patrones de Diseño',
        codigo: 'PD-001',
        estado: 'DISPONIBLE',
      },
      { key: 'Revistas:IEEE Software', codigo: 'SW-001', estado: 'DISPONIBLE' },
      {
        key: 'Tesis:Metodología de Investigación',
        codigo: 'MI-001',
        estado: 'NO_DISPONIBLE',
      },
    ] as const;

    for (const item of copySeed) {
      const resource = resourceMap.get(item.key);
      if (!resource) continue;

      const copy = await upsertCopy(resource.id, item.codigo, item.estado);
      if (copy) {
        const descripcion =
          item.estado === 'NO_DISPONIBLE'
            ? 'Ejemplar en mantenimiento o no disponible por revisión física.'
            : 'Ejemplar disponible para préstamo.';

        await upsertObservation(copy.id, descripcion);
      }
    }

    console.log('Seed de inventario completado con éxito.');
  } finally {
    await prisma.close();
  }
}
