-- Reparación PARCIAL, no una nueva migración ni un baseline.
-- Fuente: prisma/migrations/app/20261021T0508_add_versioned_suspension_policy/ops.json
-- Sólo sus tres operaciones aditivas sobre public.versiones_regla.
-- NO registrar la migración completa: quedan pendientes sus cambios de sanciones.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE "public"."versiones_regla" IN ACCESS EXCLUSIVE MODE;

DO $repair$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.versiones_regla'::regclass
      AND attname = 'diasSuspension' AND attnum > 0 AND NOT attisdropped
  ) THEN
    ALTER TABLE "public"."versiones_regla" ADD COLUMN "diasSuspension" int4;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.versiones_regla'::regclass
      AND attname = 'tipoSuspension' AND attnum > 0 AND NOT attisdropped
  ) THEN
    ALTER TABLE "public"."versiones_regla" ADD COLUMN "tipoSuspension" text;
  END IF;

  -- Existencia no basta: abortar ante tipos, defaults o nulabilidad incompatibles.
  IF (
    SELECT count(*) FROM pg_attribute a
    WHERE a.attrelid = 'public.versiones_regla'::regclass
      AND a.attnum > 0 AND NOT a.attisdropped
      AND NOT a.attnotnull AND NOT a.atthasdef
      AND a.attidentity = '' AND a.attgenerated = '' AND a.atttypmod = -1
      AND ((a.attname = 'diasSuspension' AND a.atttypid = 'pg_catalog.int4'::regtype)
        OR (a.attname = 'tipoSuspension' AND a.atttypid = 'pg_catalog.text'::regtype))
  ) <> 2 THEN
    RAISE EXCEPTION 'Reparación cancelada: columnas de suspensión incompatibles';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.versiones_regla'::regclass
      AND conname = 'versiones_regla_tipoSuspension_check_410b7d83'
  ) THEN
    ALTER TABLE "public"."versiones_regla" ADD CONSTRAINT "versiones_regla_tipoSuspension_check_410b7d83" CHECK ("tipoSuspension" IN ('NINGUNA', 'TEMPORAL', 'INDEFINIDA'));
  END IF;

  -- Forma canónica PostgreSQL de la expresión de la migración original.
  -- Una restricción homónima distinta o no validada NO se acepta ni se reemplaza.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.versiones_regla'::regclass
      AND c.conname = 'versiones_regla_tipoSuspension_check_410b7d83'
      AND c.contype = 'c' AND c.convalidated AND NOT c.connoinherit
      AND pg_get_constraintdef(c.oid) =
        'CHECK (("tipoSuspension" = ANY (ARRAY[''NINGUNA''::text, ''TEMPORAL''::text, ''INDEFINIDA''::text])))'
  ) THEN
    RAISE EXCEPTION 'Reparación cancelada: restricción de suspensión incompatible';
  END IF;
END;
$repair$;
COMMIT;
