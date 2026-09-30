import type { Request, Response, NextFunction } from "express";

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export function asyncRoute(fn: AsyncHandler) {
  return (req: Request, res: Response, next?: NextFunction): Promise<void> => {
    return Promise.resolve(fn(req, res, next as NextFunction)).catch((error) => {
      try {
        if (typeof next === "function") return next(error);
        // If we're being invoked directly (as in unit tests), convert known errors
        // into HTTP responses so tests can assert on `res`.
        if (res && typeof (res as any).status === "function") {
          const status = (error && (error as any).httpStatus) || 500;
          const code = (error && (error as any).code) || "INTERNAL_ERROR";
          const message = (error && (error as any).message) || String(error);
          (res as Response).status(status).json({ error: message, code });
          return Promise.resolve();
        }
      } catch {
        // fallthrough to rethrow
      }
      return Promise.reject(error);
    });
  };
}
