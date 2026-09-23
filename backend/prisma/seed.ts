import { seedInventory } from './seeds/inventory.seed.ts';

async function seed() {
  await seedInventory();
}

seed().catch((error) => {
  console.error('Error al ejecutar los seeds:', error);
  process.exitCode = 1;
});
