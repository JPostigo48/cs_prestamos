import { vi } from 'vitest';

// Bloquea lectura de secretos en pruebas focalizadas con dobles de persistencia.
vi.mock('dotenv/config', () => ({}));
