import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'loan-evidence';

@Injectable()
export class SupabaseStorageService {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private readonly client: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
      throw new ServiceUnavailableException(
        'La configuración de Supabase Storage no está disponible.',
      );
    }
    this.client = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  async upload(path: string, file: Express.Multer.File): Promise<void> {
    try {
      const { error } = await this.client.storage
        .from(BUCKET)
        .upload(path, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });
      if (error) throw error;
    } catch {
      this.logger.error('loan-evidence-storage: upload-failed');
      throw new InternalServerErrorException(
        'No se pudo almacenar la evidencia.',
      );
    }
  }

  async remove(path: string): Promise<void> {
    try {
      const { error } = await this.client.storage.from(BUCKET).remove([path]);
      if (error) throw error;
    } catch {
      this.logger.error('loan-evidence-storage: remove-failed');
      throw new InternalServerErrorException(
        'No se pudo limpiar la evidencia almacenada.',
      );
    }
  }

  async createSignedUrl(path: string): Promise<string> {
    try {
      const { data, error } = await this.client.storage
        .from(BUCKET)
        .createSignedUrl(path, 60 * 15);
      if (error || !data?.signedUrl) throw new Error('signing-failed');
      return data.signedUrl;
    } catch {
      this.logger.error('loan-evidence-storage: signing-failed');
      throw new InternalServerErrorException(
        'No se pudo generar el acceso a la evidencia.',
      );
    }
  }
}
