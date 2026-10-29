#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/3cf9d1df4dc3e1beccc614073cfd2522d8a7a9eb4aa054fce8aae35d82c9471c/contract';
import startContract from '../../snapshots/3cf9d1df4dc3e1beccc614073cfd2522d8a7a9eb4aa054fce8aae35d82c9471c/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/cad1da901fd9b5b506ffe9c5dded5ffe9d75f4e8f0d919360a03adda5c3a60f2/contract';
import endContract from '../../snapshots/cad1da901fd9b5b506ffe9c5dded5ffe9d75f4e8f0d919360a03adda5c3a60f2/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'solicitudes_registro',
        column: col('email', 'character varying(254)', {
          codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 254 } },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'solicitudes_registro',
        column: col('fechaAceptacionTerminos', 'timestamptz(3)', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'solicitudes_registro',
        column: col('passwordHash', 'character varying(255)', {
          codecRef: { codecId: 'sql/varchar@1', typeParams: { length: 255 } },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'solicitudes_registro',
        column: col('versionTerminosId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'solicitudes_registro',
        constraint: 'solicitudes_acceso_integral_check_93178b99',
        expression:
          '("email" IS NULL AND "passwordHash" IS NULL AND "versionTerminosId" IS NULL AND "fechaAceptacionTerminos" IS NULL) OR ("email" IS NOT NULL AND "versionTerminosId" IS NOT NULL AND "fechaAceptacionTerminos" IS NOT NULL AND ("passwordHash" IS NOT NULL OR "estado" <> \'PENDIENTE\'))',
      }),
      this.createIndex({
        schema: 'public',
        table: 'solicitudes_registro',
        index: 'solicitudes_email_pendiente_unique_8889585c',
        columns: ['email'],
        extras: { where: '"estado" = \'PENDIENTE\' AND "email" IS NOT NULL', unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'solicitudes_registro',
        index: 'solicitudes_identificador_pendiente_unique_13f8e904',
        columns: ['identificadorInstitucional'],
        extras: {
          where: '"estado" = \'PENDIENTE\' AND "identificadorInstitucional" IS NOT NULL',
          unique: true,
        },
      }),
      this.createIndex({
        schema: 'public',
        table: 'solicitudes_registro',
        index: 'solicitudes_registro_versionTerminosId_idx_37ad6954',
        columns: ['versionTerminosId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'solicitudes_registro',
        foreignKey: {
          name: 'solicitudes_registro_versionTerminosId_fkey',
          columns: ['versionTerminosId'],
          references: { schema: 'public', table: 'versiones_terminos', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
