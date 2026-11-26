import { BadRequestException, PayloadTooLargeException, type INestApplication } from '@nestjs/common';
import { json, urlencoded, type Request, type Response, type NextFunction } from 'express';

export const REGISTRATION_JSON_LIMIT = 15 * 1024 * 1024;
export const DEFAULT_BODY_LIMIT = 100 * 1024;

/** Install before init, with Nest's automatic bodyParser disabled. Prefix is explicit. */
export function installRequestBodyParser(app: INestApplication, prefix = '', rawBody = false) {
  const registrationPath = `${prefix.replace(/\/$/, '')}/auth/registration-requests`.toLowerCase();
  const verify = rawBody ? (req: Request, _res: Response, buffer: Buffer) => {
    (req as Request & { rawBody: Buffer }).rawBody = Buffer.from(buffer);
  } : undefined;
  const regular = json({ limit: DEFAULT_BODY_LIMIT, verify });
  const registration = json({ limit: REGISTRATION_JSON_LIMIT, verify });
  const form = urlencoded({ extended: true, limit: DEFAULT_BODY_LIMIT, verify });
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Express/Nest routes are case-insensitive unless configured otherwise.
    const path = req.path.replace(/\/$/, '').toLowerCase();
    const parser = req.method === 'POST' && path === registrationPath ? registration : regular;
    parser(req, res, (error?: { type?: string }) => {
      if (error?.type === 'entity.too.large') return next(new PayloadTooLargeException(
        'El cuerpo de la solicitud supera el límite permitido. Registro: JSON hasta 15 MiB; PDF hasta 10 MiB e imágenes hasta 60 KiB.',
      ));
      if (error?.type === 'entity.parse.failed') return next(new BadRequestException('El cuerpo JSON no es válido.'));
      if (error) return next(error);
      form(req, res, next);
    });
  });
}
