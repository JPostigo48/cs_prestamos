export abstract class CredentialsPort {
  abstract hash(password: string): Promise<string>;
  abstract matches(password: string, passwordHash: string): Promise<boolean>;
}
