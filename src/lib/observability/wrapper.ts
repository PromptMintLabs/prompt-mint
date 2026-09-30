import { v4 as uuidv4 } from "uuid";
import { logger } from "./logger";
import { metrics } from "./metrics";

// eslint-disable-next-line no-unused-vars
export type ApiHandler = (_req: any, _res: any) => Promise<void> | void;

/**
 * Apply hardened security headers to response
 */
function applySecurityHeaders(req: any, res: any): void {
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Prevent clickjacking attacks
  res.setHeader("X-Frame-Options", "DENY");

  // Enable XSS protection
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Control referrer information
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Restrict browser features
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  // Site isolation
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");

  // HSTS — honour Vercel proxy proto header and HSTS_FORCE env override
  const isHttps =
    req.headers?.["x-forwarded-proto"] === "https" ||
    req.secure ||
    process.env.HSTS_FORCE === "true";

  if ((process.env.NODE_ENV === "production" && isHttps) || process.env.HSTS_FORCE === "true") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }

  // Hardened Content Security Policy for API (pure JSON endpoints, no UI)
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'; object-src 'none'",
  );
}

export function withObservability(handler: ApiHandler, name: string): ApiHandler {
  return async (req, res) => {
    const requestId = uuidv4();
    const startTime = Date.now();

    // Attach request context for logging
    const childLogger = logger.child({
      requestId,
      method: req.method,
      url: req.url,
      clientIp: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
    });

    try {
      childLogger.info({ body: req.body }, `Request started: ${name}`);

      // Inject logger into request if needed, or just use the childLogger
      req.logger = childLogger;
      req.requestId = requestId;

      // Apply security headers before handler execution
      applySecurityHeaders(req, res);

      await handler(req, res);

      const duration = Date.now() - startTime;
      metrics.emit("api_request_duration_ms", duration, { path: name, status: res.statusCode });
      metrics.trackEndpointHealth(name, (res.statusCode ?? 200) < 500, duration);
      
      childLogger.info(
        { statusCode: res.statusCode, duration },
        `Request completed: ${name}`
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : "Unknown error";
      
      childLogger.error(
        { error: message, stack: error instanceof Error ? error.stack : undefined, duration },
        `Request failed: ${name}`
      );

      metrics.emit("api_request_error_total", 1, { path: name, error: message });
      metrics.trackEndpointHealth(name, false, duration);

      if (!res.writableEnded) {
        // Ensure security headers are applied even on error responses
        applySecurityHeaders(req, res);
        res.status(500).json({
          error: "Internal server error",
          requestId,
        });
      }
    }
  };
}
