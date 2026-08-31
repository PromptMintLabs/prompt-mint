import {
  SessionManager,
  InMemorySessionStore,
  buildSessionCookie,
  buildCookieFlags,
  parseCookieHeader,
  extractAccessToken,
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
  MAX_SESSIONS_PER_USER,
  hashToken,
} from "../services/session";
import { createSessionAuthMiddleware } from "../middleware/sessionAuth";

/** Deterministic clock so we can fast-forward token expiry in tests. */
function makeClock(start = 1_000_000) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe("SessionManager", () => {
  it("creates a session and validates its access token", () => {
    const clock = makeClock();
    const mgr = new SessionManager(new InMemorySessionStore(), clock.now);

    const { accessToken, refreshToken, sessionId } = mgr.createSession({
      userId: "user-1",
      ip: "127.0.0.1",
    });

    const session = mgr.validateAccessToken(accessToken);
    expect(session).not.toBeNull();
    expect(session!.userId).toBe("user-1");
    expect(session!.sessionId).toBe(sessionId);
    expect(typeof refreshToken).toBe("string");
    expect(refreshToken.length).toBeGreaterThan(0);
  });

  it("rejects an unknown access token", () => {
    const clock = makeClock();
    const mgr = new SessionManager(new InMemorySessionStore(), clock.now);
    mgr.createSession({ userId: "u" });
    expect(mgr.validateAccessToken("not-a-real-token")).toBeNull();
  });

  it("expires the access token after its TTL", () => {
    const clock = makeClock();
    const mgr = new SessionManager(new InMemorySessionStore(), clock.now);
    const { accessToken } = mgr.createSession({ userId: "u" });

    clock.advance(ACCESS_TOKEN_TTL_MS + 1);
    expect(mgr.validateAccessToken(accessToken)).toBeNull();
  });

  it("rotates the refresh token and invalidates the old one", () => {
    const clock = makeClock();
    const mgr = new SessionManager(new InMemorySessionStore(), clock.now);
    const first = mgr.createSession({ userId: "u" });

    const rotated = mgr.rotateRefreshToken(first.refreshToken);
    expect(rotated).not.toBeNull();
    // New tokens are distinct from the originals.
    expect(rotated!.accessToken).not.toBe(first.accessToken);
    expect(rotated!.refreshToken).not.toBe(first.refreshToken);

    // The previous refresh token can no longer be used.
    expect(mgr.rotateRefreshToken(first.refreshToken)).toBeNull();
    // The previous access token is revoked on rotation.
    expect(mgr.validateAccessToken(first.accessToken)).toBeNull();
    // The new access token is valid.
    expect(mgr.validateAccessToken(rotated!.accessToken)).not.toBeNull();
  });

  it("rejects an expired refresh token and revokes the session", () => {
    const clock = makeClock();
    const mgr = new SessionManager(new InMemorySessionStore(), clock.now);
    const { refreshToken, accessToken } = mgr.createSession({ userId: "u" });

    clock.advance(REFRESH_TOKEN_TTL_MS + 1);
    expect(mgr.rotateRefreshToken(refreshToken)).toBeNull();
    // The associated access token is also gone.
    expect(mgr.validateAccessToken(accessToken)).toBeNull();
  });

  it("revokes a session on logout (invalidates both tokens)", () => {
    const clock = makeClock();
    const mgr = new SessionManager(new InMemorySessionStore(), clock.now);
    const { sessionId, accessToken, refreshToken } = mgr.createSession({
      userId: "u",
    });

    expect(mgr.revokeSession(sessionId)).toBe(true);
    expect(mgr.validateAccessToken(accessToken)).toBeNull();
    expect(mgr.rotateRefreshToken(refreshToken)).toBeNull();
    expect(mgr.revokeSession(sessionId)).toBe(false); // already gone
  });

  it("revokes all sessions for a user", () => {
    const clock = makeClock();
    const mgr = new SessionManager(new InMemorySessionStore(), clock.now);
    const a = mgr.createSession({ userId: "u" });
    const b = mgr.createSession({ userId: "u" });

    expect(mgr.revokeAllSessions("u")).toBe(2);
    expect(mgr.validateAccessToken(a.accessToken)).toBeNull();
    expect(mgr.validateAccessToken(b.accessToken)).toBeNull();
  });

  it("enforces the concurrent session cap, dropping the oldest", () => {
    const clock = makeClock();
    const mgr = new SessionManager(
      new InMemorySessionStore(),
      clock.now,
      ACCESS_TOKEN_TTL_MS,
      REFRESH_TOKEN_TTL_MS,
      MAX_SESSIONS_PER_USER,
    );

    const sessions = Array.from({ length: MAX_SESSIONS_PER_USER + 2 }).map(() => {
      clock.advance(1000);
      return mgr.createSession({ userId: "u" });
    });

    // 7 created, cap is 5 → 2 oldest revoked, latest 5 survive.
    const oldest = sessions[0];
    const newest = sessions[sessions.length - 1];
    expect(mgr.validateAccessToken(oldest.accessToken)).toBeNull();
    expect(mgr.validateAccessToken(newest.accessToken)).not.toBeNull();
    expect(mgr.activeSessionCount("u")).toBe(MAX_SESSIONS_PER_USER);
  });

  it("hashes tokens so raw tokens are never compared by value", () => {
    const mgr = new SessionManager();
    const { accessToken } = mgr.createSession({ userId: "u" });
    // The stored index key is the hash, not the raw token.
    expect(hashToken(accessToken)).not.toBe(accessToken);
  });
});

describe("Secure cookie helpers", () => {
  const prevEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = prevEnv;
  });

  it("builds HttpOnly, SameSite cookies", () => {
    process.env.NODE_ENV = "development";
    const flags = buildCookieFlags("strict", false);
    expect(flags.httpOnly).toBe(true);
    expect(flags.sameSite).toBe("strict");
    expect(flags.secure).toBe(false);
    expect(flags.path).toBe("/");
  });

  it("enables Secure in production by default", () => {
    process.env.NODE_ENV = "production";
    const flags = buildCookieFlags();
    expect(flags.secure).toBe(true);
  });

  it("builds a session cookie with maxAge derived from TTL", () => {
    process.env.NODE_ENV = "development";
    const cookie = buildSessionCookie("pm_session", "abc", 60_000);
    expect(cookie.name).toBe("pm_session");
    expect(cookie.value).toBe("abc");
    expect(cookie.options.maxAge).toBe(60);
    expect(cookie.options.httpOnly).toBe(true);
    expect(cookie.options.secure).toBe(false);
  });
});

describe("Cookie / token extraction", () => {
  it("parses a raw Cookie header", () => {
    const parsed = parseCookieHeader("pm_session=xyz; theme=dark");
    expect(parsed).toEqual({ pm_session: "xyz", theme: "dark" });
  });

  it("extracts the access token from cookie or bearer header", () => {
    expect(
      extractAccessToken(
        { cookies: { pm_session: "tok" }, headers: {} },
        "pm_session",
      ),
    ).toBe("tok");
    expect(
      extractAccessToken(
        { cookies: {}, headers: { authorization: "Bearer tok2" } },
        "pm_session",
      ),
    ).toBe("tok2");
    expect(
      extractAccessToken({ cookies: {}, headers: {} }, "pm_session"),
    ).toBeNull();
  });
});

describe("sessionAuth middleware", () => {
  function fakeRes() {
    const res: any = {};
    res.status = (code: number) => {
      res._status = code;
      return res;
    };
    res.json = (body: unknown) => {
      res._json = body;
      return res;
    };
    return res;
  }

  it("attaches the session when a valid cookie is present", () => {
    const clock = makeClock();
    const mgr = new SessionManager(new InMemorySessionStore(), clock.now);
    const { accessToken } = mgr.createSession({ userId: "u" });
    const middleware = createSessionAuthMiddleware(mgr);

    const req: any = {
      headers: { cookie: `pm_session=${accessToken}` },
    };
    const res = fakeRes();
    let nexted = false;
    middleware(req, res, () => {
      nexted = true;
    });

    expect(nexted).toBe(true);
    expect(req.session?.userId).toBe("u");
  });

  it("returns 401 when a required session is missing", () => {
    const mgr = new SessionManager();
    const middleware = createSessionAuthMiddleware(mgr, { required: true });

    const req: any = { headers: {} };
    const res = fakeRes();
    middleware(req, res, () => {});

    expect(res._status).toBe(401);
  });
});
