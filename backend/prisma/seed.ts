import { seedInventory } from './seeds/inventory.seed.ts';
import { seedUsers } from './seeds/users.seed.ts';
import { seedAuth } from './seeds/auth.seed.ts';

async function seed() {
  await seedUsers();
  await seedInventory();
  await seedAuth();
}

seed().catch((error) => {
  console.error('Error al ejecutar los seeds:', error);
  process.exitCode = 1;
});
