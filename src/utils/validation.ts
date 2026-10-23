import type { Request, RequestHandler } from 'express';
import { z, type ZodType } from 'zod';
import { AppError, badRequest } from './errors';

export function formatZodError(error: z.ZodError): string {
  const issues = error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.length > 0 ? issue.path.join('.') : 'value'}: ${issue.message}`);
  const extra = error.issues.length > 3 ? ` (+${error.issues.length - 3} more)` : '';
  return `${issues.join('; ')}${extra}`;
}

function validator<T>(schema: ZodType<T>, slot: 'body' | 'query' | 'params'): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[slot]);
    if (!result.success) {
      next(badRequest(`Validation failed: ${formatZodError(result.error)}`));
      return;
    }
    req.validated = { ...req.validated, [slot]: result.data };
    next();
  };
}

export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return validator(schema, 'body');
}

export function validateQuery<T>(schema: ZodType<T>): RequestHandler {
  return validator(schema, 'query');
}

export function validateParams<T>(schema: ZodType<T>): RequestHandler {
  return validator(schema, 'params');
}

function readSlot<T>(req: Request, slot: 'body' | 'query' | 'params'): T {
  const value = req.validated?.[slot];
  if (value === undefined) {
    // Programming error: a route reached a controller without its validator.
    throw new AppError(500, 'Request validation state is missing.', 'INTERNAL_ERROR', false);
  }
  return value as T;
}

export function validatedBody<T>(req: Request): T {
  return readSlot<T>(req, 'body');
}

export function validatedQuery<T>(req: Request): T {
  return readSlot<T>(req, 'query');
}

export function validatedParams<T>(req: Request): T {
  return readSlot<T>(req, 'params');
}
