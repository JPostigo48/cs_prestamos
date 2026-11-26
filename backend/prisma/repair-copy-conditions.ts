import { runCopyRepair } from './seeds/repair-copy-conditions.runner.js';
import { CopyRepairError } from './seeds/repair-copy-conditions.seed.js';

runCopyRepair().catch((error: unknown) => {
  console.error(
    error instanceof CopyRepairError
      ? error.message
      : 'Correctivo abortado, transacción revertida. Compruebe esquema, permisos y contención. No se muestran detalles del driver ni credenciales.',
  );
  process.exitCode = 1;
});
