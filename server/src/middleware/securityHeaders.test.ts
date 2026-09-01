import { Request, Response, NextFunction } from "express";
import { securityHeaders, CSP_DIRECTIVES } from "./securityHeaders";

describe("securityHeaders middleware", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {
      secure: false,
      headers: {},
    };
    mockRes = {
      setHeader: jest.fn(),
    };
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.HSTS_FORCE;
  });

  it("should set X-Content-Type-Options to nosniff", () => {
    securityHeaders(mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.setHeader).toHaveBeenCalledWith("X-Content-Type-Options", "nosniff");
  });

  it("should set X-Frame-Options to DENY", () => {
    securityHeaders(mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.setHeader).toHaveBeenCalledWith("X-Frame-Options", "DENY");
  });

  it("should set X-XSS-Protection", () => {
    securityHeaders(mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.setHeader).toHaveBeenCalledWith("X-XSS-Protection", "1; mode=block");
  });

  it("should set Referrer-Policy", () => {
    securityHeaders(mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.setHeader).toHaveBeenCalledWith("Referrer-Policy", "strict-origin-when-cross-origin");
  });

  it("should set Permissions-Policy", () => {
    securityHeaders(mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.setHeader).toHaveBeenCalledWith("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  });

  it("should set Cross-Origin-Opener-Policy to same-origin", () => {
    securityHeaders(mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.setHeader).toHaveBeenCalledWith("Cross-Origin-Opener-Policy", "same-origin");
  });

  it("should set Cross-Origin-Resource-Policy to same-site", () => {
    securityHeaders(mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.setHeader).toHaveBeenCalledWith("Cross-Origin-Resource-Policy", "same-site");
  });

  it("should set Content-Security-Policy", () => {
    securityHeaders(mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.setHeader).toHaveBeenCalledWith("Content-Security-Policy", CSP_DIRECTIVES);
  });

  it("CSP_DIRECTIVES should contain Stellar domains in connect-src", () => {
    expect(CSP_DIRECTIVES).toContain("stellar.org");
    expect(CSP_DIRECTIVES).toContain("horizon.stellar.org");
    expect(CSP_DIRECTIVES).toContain("soroban-testnet.stellar.org");
  });

  it("CSP_DIRECTIVES should block framing (frame-ancestors 'none')", () => {
    expect(CSP_DIRECTIVES).toContain("frame-ancestors 'none'");
  });

  it("CSP_DIRECTIVES should restrict base-uri and form-action to self", () => {
    expect(CSP_DIRECTIVES).toContain("base-uri 'self'");
    expect(CSP_DIRECTIVES).toContain("form-action 'self'");
  });

  it("CSP_DIRECTIVES should block object-src", () => {
    expect(CSP_DIRECTIVES).toContain("object-src 'none'");
  });

  it("should NOT set HSTS in development (req.secure=false, no proxy header)", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    securityHeaders(mockReq as Request, mockRes as Response, mockNext);

    const hstsCall = (mockRes.setHeader as jest.Mock).mock.calls.find((call: any[]) => call[0] === "Strict-Transport-Security");
    expect(hstsCall).toBeUndefined();

    process.env.NODE_ENV = originalEnv;
  });

  it("should NOT set HSTS in production without HTTPS", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    mockReq.secure = false;
    (mockReq as any).headers = {};

    securityHeaders(mockReq as Request, mockRes as Response, mockNext);

    const hstsCall = (mockRes.setHeader as jest.Mock).mock.calls.find((call: any[]) => call[0] === "Strict-Transport-Security");
    expect(hstsCall).toBeUndefined();

    process.env.NODE_ENV = originalEnv;
  });

  it("should set HSTS in production with req.secure=true", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    mockReq.secure = true;

    securityHeaders(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.setHeader).toHaveBeenCalledWith(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );

    process.env.NODE_ENV = originalEnv;
  });

  it("should set HSTS in production with x-forwarded-proto=https (proxy scenario)", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    mockReq.secure = false;
    (mockReq as any).headers = { "x-forwarded-proto": "https" };

    securityHeaders(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.setHeader).toHaveBeenCalledWith(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );

    process.env.NODE_ENV = originalEnv;
  });

  it("should set HSTS when HSTS_FORCE=true (testing/staging override)", () => {
    process.env.HSTS_FORCE = "true";

    securityHeaders(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.setHeader).toHaveBeenCalledWith(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
  });

  it("should call next() after setting headers", () => {
    securityHeaders(mockReq as Request, mockRes as Response, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it("should set all required security headers", () => {
    securityHeaders(mockReq as Request, mockRes as Response, mockNext);

    const expectedHeaders = [
      "X-Content-Type-Options",
      "X-Frame-Options",
      "X-XSS-Protection",
      "Referrer-Policy",
      "Permissions-Policy",
      "Cross-Origin-Opener-Policy",
      "Cross-Origin-Resource-Policy",
      "Content-Security-Policy",
    ];

    expectedHeaders.forEach((header) => {
      const call = (mockRes.setHeader as jest.Mock).mock.calls.find((c: any[]) => c[0] === header);
      expect(call).toBeDefined();
    });
  });
});

