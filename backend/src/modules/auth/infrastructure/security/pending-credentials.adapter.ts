import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import { CredentialsPort } from '../../application/ports/credentials.port.js';

@Injectable()
export class PendingCredentialsAdapter implements CredentialsPort {
  async hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async matches(password: string, passwordHash: string): Promise<boolean> {
    try {
      return await argon2.verify(passwordHash, password);
    } catch {
      return false;
    }
  }
}
