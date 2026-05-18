import type { FastifyInstance } from 'fastify';
import { AppError } from '../lib/errors.js';

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: Error & { validation?: unknown; statusCode?: number }, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: error.code,
        message: error.message,
      });
    }

    if (error.validation) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: error.message,
      });
    }

    app.log.error(error);
    return reply.status(500).send({
      error: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  });
}
