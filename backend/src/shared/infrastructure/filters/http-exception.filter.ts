import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SchemaCapabilityUnavailableException } from '../prisma/schema-capabilities.js';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const statusCode = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    if (exception instanceof SchemaCapabilityUnavailableException) {
      const payload = exceptionResponse as { operation?: unknown; diagnostic?: unknown };
      const operation =
        typeof payload.operation === 'string' &&
        payload.operation.length <= 96 &&
        /^[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9]*){1,3}$/.test(payload.operation)
          ? payload.operation
          : 'schema.unavailable';
      const diagnostic = payload.diagnostic === 'SCHEMA_INCOMPLETE'
        ? 'SCHEMA_INCOMPLETE' : 'SCHEMA_UNKNOWN';
      // Rebuild the trusted message and whitelist exactly the capability contract.
      const safe = new SchemaCapabilityUnavailableException(operation, diagnostic)
        .getResponse() as { message: string };
      response.status(503).json({
        statusCode: 503,
        code: 'SCHEMA_CAPABILITY_UNAVAILABLE',
        operation,
        diagnostic,
        message: safe.message,
      });
      return;
    }
    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as { message?: string | string[] }).message ??
          exception.message;

    response.status(statusCode).json({
      statusCode,
      error: exception.name.replace('Exception', '').replace(/([A-Z])/g, ' $1').trim(),
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
