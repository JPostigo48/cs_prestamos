export enum AccessRole {
  USER = 'USUARIO',
  OPERATOR = 'OPERADOR',
  ADMINISTRATOR = 'ADMINISTRADOR',
}

export interface AccessAccount {
  id: string;
  userId: string;
  email: string;
  passwordHash: string;
  role: AccessRole;
  enabled: boolean;
  lastAccessAt: Date | null;
}
