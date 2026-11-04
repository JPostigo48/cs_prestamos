import { definePrismaConfig } from 'prisma/config';
import { defineConfig as ormConfig } from '@prisma/orm-postgres/config';

// Generación de contratos/migraciones solamente: no carga dotenv ni credenciales.
export default definePrismaConfig({
  orm: ormConfig({
    contract: './prisma/contract.prisma',
    db: { connection: 'postgresql://offline:offline@127.0.0.1:1/offline' },
    migrations: { dir: './prisma/migrations' },
  }),
});
