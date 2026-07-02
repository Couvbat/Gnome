import { Request, Response, NextFunction } from 'express';

export interface CustomError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  error: CustomError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  // Log error details
  console.error(`[${new Date().toISOString()}] Error ${statusCode}: ${message}`);
  if (statusCode === 500) {
    console.error(error.stack);
  }

  // Don't expose internal errors in production
  const responseMessage = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'Something went wrong!'
    : message;

  res.status(statusCode).json({ error: responseMessage });
};

export class AppError extends Error implements CustomError {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}