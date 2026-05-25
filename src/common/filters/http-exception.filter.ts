import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { Response } from 'express';

function toErrorMessage(value: string | string[] | undefined, fallback: string): string {
  if (value === undefined) return fallback;
  return Array.isArray(value) ? value.join(', ') : value;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Sunucu hatası';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else {
        const payload = body as { message?: string | string[] };
        message = toErrorMessage(payload.message, message);
      }
    } else if (exception instanceof PrismaClientKnownRequestError) {
      this.logger.error(exception.message, exception.stack);
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = 'Bu kayıt zaten mevcut (e-posta, telefon veya vergi no)';
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
      if (exception.message.includes('Unique constraint')) {
        status = HttpStatus.CONFLICT;
        message = 'Bu kayıt zaten mevcut (e-posta, telefon veya vergi no)';
      } else if (
        exception.message.includes('member_code') ||
        exception.message.includes('org_code') ||
        exception.message.includes('does not exist in the current database')
      ) {
        message =
          'Kayıt şu an kullanılamıyor (sunucu veritabanı güncellemesi gerekli). Lütfen destek ile iletişime geçin.';
      } else if (
        exception.message.includes('Geçersiz') ||
        exception.message.includes('Şifre') ||
        exception.message.includes('sektör')
      ) {
        status = HttpStatus.BAD_REQUEST;
        message = exception.message;
      }
    }

    res.status(status).json({
      success: false,
      statusCode: status,
      message,
    });
  }
}
