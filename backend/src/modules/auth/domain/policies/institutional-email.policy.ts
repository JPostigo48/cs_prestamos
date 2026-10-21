import { BadRequestException } from '@nestjs/common';

export class InstitutionalEmailPolicy {
  static normalize(email: string): string {
    return email.trim().toLowerCase();
  }

  static isValid(email: string): boolean {
    const normalized = this.normalize(email);
    return /^[^\s@]+@unsa\.edu\.pe$/.test(normalized);
  }

  static assertValid(email: string): string {
    const normalized = this.normalize(email);
    if (!this.isValid(normalized)) {
      throw new BadRequestException(
        'Solo se permiten correos institucionales @unsa.edu.pe.',
      );
    }
    return normalized;
  }
}
