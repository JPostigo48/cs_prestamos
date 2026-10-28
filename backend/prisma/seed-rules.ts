import { runRulesSeed } from './seeds/rules.runner.js';
import { RulesSeedError } from './seeds/rules.seed.js';

runRulesSeed().catch((error: unknown) => {
  // No imprimir errores del driver que pudieran incluir una URL o credenciales.
  console.error(
    error instanceof RulesSeedError
      ? error.message
      : 'Seed no aplicado. Verifique la configuración o el error del driver en un entorno seguro.',
  );
  process.exitCode = 1;
});
