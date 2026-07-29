import { Request, Response, NextFunction } from "express";
import { securityHeaders } from "./securityHeaders";

describe("securityHeaders middleware", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

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

  it("should set Content-Security-Policy", () => {
    securityHeaders(mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      "Content-Security-Policy",
      expect.stringContaining("default-src 'self'")
    );
  });

  it("should set CSP with Stellar domains", () => {
    securityHeaders(mockReq as Request, mockRes as Response, mockNext);
    const cspCall = mockRes.setHeader.mock.calls.find((call: any[]) => call[0] === "Content-Security-Policy");
    expect(cspCall).toBeDefined();
    expect(cspCall![1]).toContain("stellar.org");
    expect(cspCall![1]).toContain("horizon.stellar.org");
  });

  it("should NOT set HSTS in development", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    
    securityHeaders(mockReq as Request, mockRes as Response, mockNext);
    
    const hstsCall = mockRes.setHeader.mock.calls.find((call: any[]) => call[0] === "Strict-Transport-Security");
    expect(hstsCall).toBeUndefined();
    
    process.env.NODE_ENV = originalEnv;
  });

  it("should NOT set HSTS in production without HTTPS", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    mockReq.secure = false;
    
    securityHeaders(mockReq as Request, mockRes as Response, mockNext);
    
    const hstsCall = mockRes.setHeader.mock.calls.find((call: any[]) => call[0] === "Strict-Transport-Security");
    expect(hstsCall).toBeUndefined();
    
    process.env.NODE_ENV = originalEnv;
  });

  it("should set HSTS in production with HTTPS", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    mockReq.secure = true;
    
    securityHeaders(mockReq as Request, mockRes as Response, mockNext);
    
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
    
    process.env.NODE_ENV = originalEnv;
  });

  it("should call next() after setting headers", () => {
    securityHeaders(mockReq as Request, mockRes as Response, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it("should set all expected security headers", () => {
    securityHeaders(mockReq as Request, mockRes as Response, mockNext);
    
    const expectedHeaders = [
      "X-Content-Type-Options",
      "X-Frame-Options",
      "X-XSS-Protection",
      "Referrer-Policy",
      "Permissions-Policy",
      "Content-Security-Policy",
    ];
    
    expectedHeaders.forEach(header => {
      const call = mockRes.setHeader.mock.calls.find((c: any[]) => c[0] === header);
      expect(call).toBeDefined();
    });
  });
});
