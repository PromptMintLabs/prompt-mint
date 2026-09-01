import type { Request, Response, NextFunction } from "express";
import {
  SessionManager,
  extractAccessToken,
  parseCookieHeader,
  type Session,
} from "../services/session";

/**
 * Attaches the resolved session (if any) to `req.session` and exposes the
 * manager on `req.sessionManager` so route handlers can refresh/revoke.
 *
 * No `cookie-parser` dependency is required: the Cookie header is parsed
 * inline. Pair this with `buildSessionCookie` when setting the cookie on
 * login/refresh responses.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      session?: Session | null;
      sessionManager?: SessionManager;
    }
  }
}

export interface SessionAuthOptions {
  cookieName?: string;
  /** When true, a missing/invalid token is a 401 instead of `req.session = null`. */
  required?: boolean;
}

export function createSessionAuthMiddleware(
  manager: SessionManager,
  options: SessionAuthOptions = {},
) {
  const cookieName = options.cookieName ?? "pm_session";

  return function sessionAuth(req: Request, res: Response, next: NextFunction) {
    req.sessionManager = manager;

    // Normalize Express's `IncomingHttpHeaders` (which allows `string[]`
    // values) into the flat string map our extractor expects.
    const headers: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      headers[key] = Array.isArray(value) ? value[0] : value;
    }

    const cookies = parseCookieHeader(headers.cookie);
    const token = extractAccessToken({ cookies, headers }, cookieName);

    req.session = token ? manager.validateAccessToken(token) : null;

    if (options.required && !req.session) {
      res.status(401).json({ error: "Unauthorized", message: "Session expired or missing." });
      return;
    }

    next();
  };
}
