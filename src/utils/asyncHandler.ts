import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Mandated controller wrapper (Architecture.md, section 3). Express 5 forwards
 * rejected promises on its own, but wrapping keeps every handler on one explicit
 * error path and stays compatible if the framework major ever changes.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
