import { definePrismaConfig } from 'prisma/config';
import { defineConfig as ormConfig } from '@prisma/orm-postgres/config';

/** Emisión/planificación local: no carga dotenv ni configura conexión. */
export default definePrismaConfig({
  orm: ormConfig({
    contract: './prisma/contract.prisma',
    migrations: { dir: './prisma/migrations' },
  }),
});
