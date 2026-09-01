# Security Headers Implementation

This document describes the hardened security headers implemented across all deployment paths for Prompt Mint (#256).

## Overview

Security headers are applied to all HTTP responses across three deployment paths:

1. **Vercel Frontend & Serverless Functions** - Configured in `vercel.json`
2. **Express Server** - Applied via middleware in `server/src/middleware/securityHeaders.ts`
3. **Serverless API Endpoints** - Applied via observability wrapper in `src/lib/observability/wrapper.ts`

## Security Headers Applied

### Common Headers (All Paths)

- **X-Content-Type-Options: nosniff** — Prevents MIME type sniffing
- **X-Frame-Options: DENY** — Blocks all framing/clickjacking
- **X-XSS-Protection: 1; mode=block** — Legacy XSS filter for older browsers
- **Referrer-Policy: strict-origin-when-cross-origin** — Limits referrer leakage
- **Permissions-Policy: camera=(), microphone=(), geolocation=()** — Disables sensitive browser APIs
- **Cross-Origin-Opener-Policy: same-origin** — Process isolation between origins
- **Cross-Origin-Resource-Policy: same-site** — Restricts cross-origin embedding

### HTTPS-Specific Headers

- **Strict-Transport-Security: max-age=31536000; includeSubDomains; preload**
  - Enforces HTTPS connections for 1 year
  - Applied in production when HTTPS detected via `req.secure`, `x-forwarded-proto: https`, or `HSTS_FORCE=true`
  - Applied globally in `vercel.json` at the edge

### Content Security Policy

#### Express Server / Vercel Frontend
```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
font-src 'self' data:;
connect-src 'self' https://*.stellar.org https://horizon.stellar.org https://horizon-testnet.stellar.org https://soroban-testnet.stellar.org https://soroban.stellar.org https://secret-ai-gateway.onrender.com;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
object-src 'none'
```

#### Serverless API Endpoints (pure JSON, no UI)
```
default-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'; object-src 'none'
```

## Deployment Path Details

### 1. Vercel Configuration (`vercel.json`)

**Scope**: All paths including static assets and serverless functions

**Headers Applied**:
- Common headers to all paths (`/(.*)`)
- HSTS to API paths (`/api/(.*)`)

**Behavior**:
- Headers set at edge level before request reaches application code
- Applied to both frontend routes and API routes
- HSTS only applied to API endpoints

**Edge Cases**:
- Headers apply to all responses including static files
- HSTS conditionally applied to API paths only
- No CSP in Vercel config (handled by application code)

### 2. Express Server (`server/src/server.ts`)

**Scope**: All Express server routes

**Middleware**: `server/src/middleware/securityHeaders.ts`

**Headers Applied**:
- All common headers
- HSTS (production + HTTPS only)
- CSP with Stellar-specific allowlist

**Behavior**:
- Applied globally via `app.use(securityHeaders)`
- Executed before route handlers
- Applied to all responses including error responses

**Edge Cases**:
- HSTS only applied in production with HTTPS
- CSP allows inline scripts/styles for frontend compatibility
- CSP includes Stellar RPC/Horizon domains for blockchain operations
- Local development: HSTS not applied (non-HTTPS)

### 3. Serverless API Endpoints (`src/lib/observability/wrapper.ts`)

**Scope**: All serverless API handlers using `withObservability` wrapper

**Wrapper**: `src/lib/observability/wrapper.ts`

**Headers Applied**:
- All common headers
- HSTS (production + HTTPS only)
- Minimal CSP for API endpoints

**Behavior**:
- Applied via `withObservability` wrapper
- Executed before handler execution
- Applied to both success and error responses

**Edge Cases**:
- HSTS only applied in production with HTTPS
- CSP is minimal (`default-src 'none'`) for API-only responses
- Headers applied even when handler throws errors
- Uses `x-forwarded-proto` header to detect HTTPS in Vercel

## Behavior and Edge Cases

### Environment-Specific Behavior

#### Development Environment
- HSTS not applied (non-HTTPS connections)
- All other headers applied normally
- CSP allows inline scripts/styles for development tools

#### Production Environment
- HSTS applied when HTTPS detected
- All headers applied strictly
- CSP enforces Stellar domain restrictions

### HTTPS Detection

#### Express Server
- Uses `req.secure` property
- Only true when direct HTTPS connection
- May not work behind some proxies

#### Serverless Functions
- Uses `req.headers["x-forwarded-proto"] === "https"`
- Works with Vercel's proxy headers
- Falls back to `req.secure` as backup

### Error Responses

#### Express Server
- Security headers applied via middleware
- Headers present on all responses including errors
- No special handling needed

#### Serverless Functions
- Security headers applied in error handler
- Explicit call to `applySecurityHeaders(req, res)` in catch block
- Ensures headers present even on unhandled errors

### Header Conflicts

#### Vercel vs Application
- Vercel headers set first at edge
- Application headers may override Vercel headers
- No conflicts expected (complementary configuration)

#### Multiple Middleware
- Security headers middleware applied first
- Other middleware may add headers
- No conflicts with existing rate limit headers

### CSP Considerations

#### Frontend Compatibility
- Inline scripts allowed for React hydration
- Inline styles allowed for styled-components
- Data URLs allowed for images/fonts

#### Stellar Integration
- Stellar RPC domains explicitly allowed
- Horizon endpoints explicitly allowed
- WebSocket connections may need additional CSP directives

#### API Endpoints
- Minimal CSP for API responses
- No script/style restrictions needed
- Focus on preventing framing

## Backward Compatibility

### Existing Flows

#### Marketplace Flows
- No impact on contract interactions
- No impact on wallet connections
- No impact on encryption/decryption
- Headers are response-only, no request changes

#### API Endpoints
- No breaking changes to request/response format
- Headers are additive, not modifying existing behavior
- Rate limiting headers continue to work
- Error responses maintain same structure

#### Frontend
- CSP allows existing script loading patterns
- No changes to asset loading
- No changes to Stellar SDK integration
- No changes to wallet extension communication

### Migration Requirements

#### No Migration Needed
- Headers are purely additive
- No database changes required
- No contract changes required
- No client-side changes required

#### Optional Enhancements
- Consider adding nonce-based CSP for stricter security
- Consider adding report-uri for CSP violations
- Consider adding Expect-CT header for certificate transparency

## Testing

### Automated Security Scanner

Run the security scanner against the DAST target:

```bash
# Start DAST target
node scripts/security/dast-target.mjs &

# Run security header scanner
node scripts/security/scan-security-headers.mjs

# Or scan a custom target
node scripts/security/scan-security-headers.mjs https://your-domain.com
```

### Manual Testing

```bash
# Verify all headers on any endpoint
curl -I https://your-domain.com/health

# Verify CSP
curl -sI https://your-domain.com | grep -i content-security-policy

# Verify CORS blocks unknown origin
curl -I -H "Origin: https://evil-attacker.com" https://your-domain.com/api/health
```

### Automated Test Suites

- `server/src/middleware/securityHeaders.test.ts` — Covers all headers, CSP directives, HSTS proxy detection, HSTS_FORCE override, COOP/CORP.
- `server/src/config/cors.test.ts` — Covers origin normalization, allowlist enforcement, exposed headers, preflight maxAge.

## Security Considerations

### HSTS Preload
- Configuration is preload-eligible
- Consider submitting to the HSTS preload list at https://hstspreload.org/

### CSP Evolution
- Current CSP allows `unsafe-inline` and `unsafe-eval` for React/frontend compatibility
- Future: migrate to nonce-based CSP with `Content-Security-Policy-Report-Only` for testing
- Consider adding `report-uri` or `report-to` for CSP violation reporting in production

### References

- [OWASP Security Headers](https://owasp.org/www-project-secure-headers/)
- [MDN Web Security](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers)
- [HSTS Preload List](https://hstspreload.org/)
- [Content Security Policy Level 3](https://www.w3.org/TR/CSP3/)
- [MDN Cross-Origin-Opener-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Opener-Policy)
