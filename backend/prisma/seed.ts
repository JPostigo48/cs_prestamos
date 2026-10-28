import { seedInventory } from './seeds/inventory.seed.ts';
import { seedUsers } from './seeds/users.seed.ts';
import { seedAuth } from './seeds/auth.seed.ts';
import { runRulesSeed } from './seeds/rules.runner.js';

async function seed() {
  // Primero las políticas: ante conflicto no ejecutar los seeds de demostración.
  await runRulesSeed();
  await seedUsers();
  await seedInventory();
  await seedAuth();
}

seed().catch((error) => {
  console.error('Error al ejecutar los seeds:', error);
  process.exitCode = 1;
});
