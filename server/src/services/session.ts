import { randomBytes, createHash, timingSafeEqual } from "crypto";

/**
 * Session & token lifecycle management (#258).
 *
 * Implements the security properties called out in the issue:
 *  - Short-lived access tokens with explicit expiration.
 *  - Refresh tokens that ROTATE on every use (the previous refresh token is
 *    invalidated the moment a new pair is issued), limiting the blast radius
 *    of a leaked refresh token.
 *  - Secure cookie flags (HttpOnly, Secure, SameSite) via `buildSessionCookie`.
 *  - Logout invalidation (`revokeSession`) and global sign-out
 *    (`revokeAllSessions`) that drop both token indexes.
 *  - Concurrent session handling: a per-user cap (`MAX_SESSIONS_PER_USER`)
 *    revokes the oldest session when exceeded.
 *
 * The store is deliberately in-memory and injected so it can be swapped for a
 * shared/Redis-backed store later without touching callers. No database or
 * Express imports are present so the logic stays unit-testable in isolation.
 */

export interface Session {
  sessionId: string;
  userId: string;
  createdAt: number;
  lastUsedAt: number;
  /** Absolute expiry (ms epoch) of the current access token. */
  expiresAt: number;
  /** Absolute expiry (ms epoch) of the current refresh token. */
  refreshExpiresAt: number;
  ip?: string;
  userAgent?: string;
  /** Internal: hash of the currently issued access token. */
  accessTokenHash?: string;
  /** Internal: hash of the currently issued refresh token. */
  refreshTokenHash?: string;
}

export interface CreateSessionParams {
  userId: string;
  ip?: string;
  userAgent?: string;
}

export interface SessionTokens {
  sessionId: string;
  /** Opaque, unguessable access token. Shown to the client exactly once. */
  accessToken: string;
  /** Opaque refresh token. Shown to the client exactly once. */
  refreshToken: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
}

export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const MAX_SESSIONS_PER_USER = 5;

const ACCESS_TOKEN_BYTES = 32;
const REFRESH_TOKEN_BYTES = 48;
const SESSION_ID_BYTES = 16;

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function safeEqual(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export interface SessionStore {
  get(sessionId: string): Session | undefined;
  set(session: Session): void;
  delete(sessionId: string): void;
  listByUser(userId: string): Session[];
}

/**
 * Default in-memory store. Suitable for a single-process server; replace with
 * a Redis/DB-backed implementation (implementing `SessionStore`) for multi-
 * instance deployments.
 */
export class InMemorySessionStore implements SessionStore {
  private sessions = new Map<string, Session>();

  get(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  set(session: Session): void {
    this.sessions.set(session.sessionId, session);
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  listByUser(userId: string): Session[] {
    return [...this.sessions.values()].filter((s) => s.userId === userId);
  }
}

export class SessionManager {
  private readonly accessTokens = new Map<string, string>(); // accessHash -> sessionId
  private readonly refreshTokens = new Map<string, string>(); // refreshHash -> sessionId

  constructor(
    private readonly store: SessionStore = new InMemorySessionStore(),
    private readonly now: () => number = () => Date.now(),
    private readonly accessTtlMs: number = ACCESS_TOKEN_TTL_MS,
    private readonly refreshTtlMs: number = REFRESH_TOKEN_TTL_MS,
    private readonly maxSessionsPerUser: number = MAX_SESSIONS_PER_USER,
  ) {}

  /** Creates a session, enforcing the concurrent-session cap. */
  createSession(params: CreateSessionParams): SessionTokens {
    const existing = this.store.listByUser(params.userId);
    if (existing.length >= this.maxSessionsPerUser) {
      const oldest = existing.sort((a, b) => a.createdAt - b.createdAt)[0];
      this.revokeSession(oldest.sessionId);
    }

    const session: Session = {
      sessionId: randomBytes(SESSION_ID_BYTES).toString("hex"),
      userId: params.userId,
      createdAt: this.now(),
      lastUsedAt: this.now(),
      expiresAt: 0,
      refreshExpiresAt: 0,
      ip: params.ip,
      userAgent: params.userAgent,
    };

    return this.issue(session);
  }

  /** Issues a fresh access + refresh token pair for an existing session. */
  private issue(session: Session): SessionTokens {
    const accessToken = randomBytes(ACCESS_TOKEN_BYTES).toString("hex");
    const refreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString("hex");

    session.expiresAt = this.now() + this.accessTtlMs;
    session.refreshExpiresAt = this.now() + this.refreshTtlMs;
    session.lastUsedAt = this.now();

    const accessHash = hashToken(accessToken);
    const refreshHash = hashToken(refreshToken);

    session.accessTokenHash = accessHash;
    session.refreshTokenHash = refreshHash;

    this.store.set(session);
    this.accessTokens.set(accessHash, session.sessionId);
    this.refreshTokens.set(refreshHash, session.sessionId);

    return {
      sessionId: session.sessionId,
      accessToken,
      refreshToken,
      accessTokenExpiresAt: session.expiresAt,
      refreshTokenExpiresAt: session.refreshExpiresAt,
    };
  }

  /** Validates an access token, returning the live session or null. */
  validateAccessToken(accessToken: string | undefined | null): Session | null {
    if (!accessToken) return null;
    const sessionId = this.accessTokens.get(hashToken(accessToken));
    if (!sessionId) return null;

    const session = this.store.get(sessionId);
    if (!session) return null;

    if (this.now() >= session.expiresAt) {
      // Expired access token — leave the refresh token usable for rotation.
      return null;
    }

    session.lastUsedAt = this.now();
    return session;
  }

  /**
   * Rotates a refresh token: validates it, invalidates the presented refresh
   * token immediately, and issues a brand-new access + refresh pair. The old
   * access token is also revoked. Returns null if the refresh token is unknown
   * or expired.
   */
  rotateRefreshToken(refreshToken: string | undefined | null): SessionTokens | null {
    if (!refreshToken) return null;
    const sessionId = this.refreshTokens.get(hashToken(refreshToken));
    if (!sessionId) return null;

    const session = this.store.get(sessionId);
    if (!session) return null;

    if (this.now() >= session.refreshExpiresAt) {
      // Refresh token expired — revoke it and the session entirely.
      this.revokeSession(sessionId);
      return null;
    }

    // Rotation: drop the old refresh token and old access token right away.
    this.refreshTokens.delete(hashToken(refreshToken));
    if (session.accessTokenHash) {
      this.accessTokens.delete(session.accessTokenHash);
    }

    return this.issue(session);
  }

  /** Logs a session out: drops both token indexes and the session record. */
  revokeSession(session: string): boolean {
    const record = this.store.get(session);
    if (!record) return false;

    if (record.accessTokenHash) this.accessTokens.delete(record.accessTokenHash);
    if (record.refreshTokenHash) this.refreshTokens.delete(record.refreshTokenHash);
    this.store.delete(session);
    return true;
  }

  /** Revokes every session for a user (global sign-out). */
  revokeAllSessions(userId: string): number {
    const sessions = this.store.listByUser(userId);
    for (const s of sessions) {
      this.revokeSession(s.sessionId);
    }
    return sessions.length;
  }

  getSession(sessionId: string): Session | undefined {
    return this.store.get(sessionId);
  }

  /** Active (non-expired) session count for a user. */
  activeSessionCount(userId: string): number {
    const now = this.now();
    return this.store
      .listByUser(userId)
      .filter((s) => now < s.refreshExpiresAt)
      .length;
  }
}

// ── Secure cookie helpers ─────────────────────────────────────────────────────

export type SameSitePolicy = "strict" | "lax" | "none";

export interface SessionCookieFlags {
  httpOnly: true;
  secure: boolean;
  sameSite: SameSitePolicy;
  path: string;
}

export interface SessionCookie {
  name: string;
  value: string;
  options: SessionCookieFlags & { maxAge: number };
}

/** Whether the Secure flag should be set, honouring an explicit override. */
export function getCookieSecure(): boolean {
  const override = process.env.SESSION_COOKIE_SECURE;
  if (override !== undefined) return override !== "false" && override !== "0";
  return process.env.NODE_ENV === "production";
}

/**
 * Builds the secure cookie attributes required for session tokens.
 * Defaults: HttpOnly, Secure (in prod / when overridden), SameSite=Lax.
 */
export function buildCookieFlags(
  sameSite: SameSitePolicy = "lax",
  secure: boolean = getCookieSecure(),
): SessionCookieFlags {
  return {
    httpOnly: true,
    secure,
    sameSite,
    path: "/",
  };
}

/**
 * Builds a session cookie descriptor. Use the returned `options` with
 * `res.cookie(name, value, options)` (Express) or serialize manually.
 */
export function buildSessionCookie(
  name: string,
  value: string,
  maxAgeMs: number,
  sameSite: SameSitePolicy = "lax",
): SessionCookie {
  const secure = getCookieSecure();
  return {
    name,
    value,
    options: {
      ...buildCookieFlags(sameSite, secure),
      maxAge: Math.floor(maxAgeMs / 1000),
    },
  };
}

/** Minimal shape of an Express-style request for token extraction. */
export interface RequestLike {
  cookies?: Record<string, string | undefined>;
  headers?: Record<string, string | undefined>;
}

/** Extracts a bearer token from the Authorization header, if present. */
export function extractBearerToken(req: RequestLike): string | null {
  const header = req.headers?.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

/**
 * Extracts the access token from either the session cookie or the
 * Authorization header. Cookie takes precedence (matches browser behaviour).
 */
export function extractAccessToken(
  req: RequestLike,
  cookieName = "pm_session",
): string | null {
  const fromCookie = req.cookies?.[cookieName];
  if (fromCookie) return fromCookie;
  return extractBearerToken(req);
}

/**
 * Parses a raw `Cookie` header into a record. Used by the middleware so no
 * `cookie-parser` dependency is required.
 */
export function parseCookieHeader(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

/** Constant-time string comparison for token equality checks. */
export function tokensEqual(a: string | undefined, b: string | undefined): boolean {
  return safeEqual(a, b);
}
