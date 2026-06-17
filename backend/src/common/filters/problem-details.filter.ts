import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  correlationId?: string;
  errors?: Record<string, string[]>;
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const correlationId =
      (request.headers['x-correlation-id'] as string) ||
      (request as Request & { correlationId?: string }).correlationId;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = 'Internal Server Error';
    let detail: string | undefined;
    let errors: Record<string, string[]> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'string') {
        detail = body;
        title = this.titleForStatus(status);
      } else if (typeof body === 'object' && body !== null) {
        const obj = body as Record<string, unknown>;
        title = (obj.error as string) || (obj.message as string) || this.titleForStatus(status);
        if (Array.isArray(obj.message)) {
          detail = obj.message.join('; ');
          errors = { validation: obj.message as string[] };
        } else if (typeof obj.message === 'string') {
          detail = obj.message;
        }
      }
    } else if (exception instanceof Error) {
      detail = exception.message;
      this.logger.error(exception.message, exception.stack);
    }

    const problem: ProblemDetails = {
      type: `https://vixa.platform/problems/${this.slugForStatus(status)}`,
      title,
      status,
      detail,
      instance: request.url,
      correlationId,
      ...(errors ? { errors } : {}),
    };

    response
      .status(status)
      .type('application/problem+json')
      .json(problem);
  }

  private titleForStatus(status: number): string {
    const map: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      429: 'Too Many Requests',
    };
    return map[status] ?? 'Internal Server Error';
  }

  private slugForStatus(status: number): string {
    return this.titleForStatus(status).toLowerCase().replace(/\s+/g, '-');
  }
}
