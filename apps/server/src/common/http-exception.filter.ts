import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import type { ApiError } from '@meanstack/shared';

/** Every error leaves the API as `{ message }`, like the original Express backend. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const raw =
        typeof body === 'string' ? body : (body as { message?: string | string[] }).message;
      const message = Array.isArray(raw) ? raw.join(', ') : (raw ?? exception.message);
      const payload: ApiError = { message };
      return res.status(exception.getStatus()).json(payload);
    }
    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    const payload: ApiError = { message: 'Internal server error!' };
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(payload);
  }
}
