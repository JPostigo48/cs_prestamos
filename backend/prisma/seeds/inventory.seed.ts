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
      { nombre: 'Audiovisuales', tiempoMaximoPrestamoDias: 7 },
      { nombre: 'Equipos de Laboratorio', tiempoMaximoPrestamoDias: 3 },
      { nombre: 'Juegos de Lógica', tiempoMaximoPrestamoDias: 7 },
      { nombre: 'Colecciones Especiales', tiempoMaximoPrestamoDias: 14 },
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
        categoria: 'Libros',
        nombre: 'Estructuras de Datos y Algoritmos',
        descripcion:
          'Material de apoyo para cursos de programación y resolución de problemas.',
      },
      {
        categoria: 'Libros',
        nombre: 'Sistemas Operativos Modernos',
        descripcion:
          'Fundamentos de procesos, memoria, sistemas de archivos y concurrencia.',
      },
      {
        categoria: 'Libros',
        nombre: 'Redes de Computadoras',
        descripcion:
          'Conceptos de redes, protocolos y servicios para prácticas de laboratorio.',
      },
      {
        categoria: 'Revistas',
        nombre: 'IEEE Software',
        descripcion: 'Revista técnica con artículos de ingeniería de software.',
      },
      {
        categoria: 'Revistas',
        nombre: 'Computing Reviews',
        descripcion:
          'Selección de tendencias y revisiones sobre computación y tecnología.',
      },
      {
        categoria: 'Tesis',
        nombre: 'Metodología de Investigación',
        descripcion: 'Material académico de apoyo para investigación aplicada.',
      },
      {
        categoria: 'Tesis',
        nombre: 'Catálogo de Trabajos de Grado',
        descripcion: 'Recurso sin ejemplares para validar su gestión independiente.',
      },
      {
        categoria: 'Audiovisuales',
        nombre: 'Curso de Desarrollo Web',
        descripcion:
          'Material audiovisual de apoyo para fundamentos de desarrollo web.',
      },
      {
        categoria: 'Equipos de Laboratorio',
        nombre: 'Kit de Desarrollo Raspberry Pi',
        descripcion:
          'Kit para prácticas de sistemas embebidos, redes y proyectos de hardware.',
      },
      {
        categoria: 'Equipos de Laboratorio',
        nombre: 'Placa Arduino para Prototipado',
        descripcion:
          'Placa y accesorios para prácticas de electrónica y computación física.',
      },
      {
        categoria: 'Equipos de Laboratorio',
        nombre: 'Laptop para Laboratorio',
        descripcion:
          'Equipo portátil para prácticas de programación, redes y desarrollo de software.',
      },
      {
        categoria: 'Juegos de Lógica',
        nombre: 'Ajedrez para Sala de Estudio',
        descripcion:
          'Juego de estrategia para actividades de razonamiento y trabajo colaborativo.',
      },
      {
        categoria: 'Juegos de Lógica',
        nombre: 'Rompecabezas de Algoritmos',
        descripcion:
          'Material lúdico para practicar secuencias, patrones y pensamiento lógico.',
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
      {
        key: 'Libros:Estructuras de Datos y Algoritmos',
        codigo: 'EDA-001',
        estado: 'DISPONIBLE',
      },
      {
        key: 'Libros:Estructuras de Datos y Algoritmos',
        codigo: 'EDA-002',
        estado: 'NO_DISPONIBLE',
      },
      {
        key: 'Libros:Sistemas Operativos Modernos',
        codigo: 'SOM-001',
        estado: 'DISPONIBLE',
      },
      {
        key: 'Libros:Redes de Computadoras',
        codigo: 'RED-001',
        estado: 'DISPONIBLE',
      },
      { key: 'Revistas:IEEE Software', codigo: 'SW-001', estado: 'DISPONIBLE' },
      {
        key: 'Revistas:Computing Reviews',
        codigo: 'CR-001',
        estado: 'DISPONIBLE',
      },
      {
        key: 'Tesis:Metodología de Investigación',
        codigo: 'MI-001',
        estado: 'NO_DISPONIBLE',
      },
      {
        key: 'Audiovisuales:Curso de Desarrollo Web',
        codigo: 'WEB-001',
        estado: 'DISPONIBLE',
      },
      {
        key: 'Equipos de Laboratorio:Kit de Desarrollo Raspberry Pi',
        codigo: 'RPI-001',
        estado: 'DISPONIBLE',
      },
      {
        key: 'Equipos de Laboratorio:Kit de Desarrollo Raspberry Pi',
        codigo: 'RPI-002',
        estado: 'NO_DISPONIBLE',
      },
      {
        key: 'Equipos de Laboratorio:Placa Arduino para Prototipado',
        codigo: 'ARD-001',
        estado: 'DISPONIBLE',
      },
      {
        key: 'Equipos de Laboratorio:Laptop para Laboratorio',
        codigo: 'LAB-001',
        estado: 'DISPONIBLE',
      },
      {
        key: 'Juegos de Lógica:Ajedrez para Sala de Estudio',
        codigo: 'AJD-001',
        estado: 'DISPONIBLE',
      },
      {
        key: 'Juegos de Lógica:Rompecabezas de Algoritmos',
        codigo: 'LOG-001',
        estado: 'DISPONIBLE',
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
