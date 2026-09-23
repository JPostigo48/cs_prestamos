import { Injectable } from '@nestjs/common';
import { CredentialsPort } from '../../application/ports/credentials.port.js';

@Injectable()
export class PendingCredentialsAdapter implements CredentialsPort {
  async hash(_password: string): Promise<string> {
    // TODO
    throw new Error('Not implemented');
  }

  async matches(_password: string, _passwordHash: string): Promise<boolean> {
    // TODO
    throw new Error('Not implemented');
  }
}
