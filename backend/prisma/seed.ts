import { seedInventory } from './seeds/inventory.seed.ts';
import { seedUsers } from './seeds/users.seed.ts';

async function seed() {
  await seedUsers();
  await seedInventory();
}

seed().catch((error) => {
  console.error('Error al ejecutar los seeds:', error);
  process.exitCode = 1;
});
