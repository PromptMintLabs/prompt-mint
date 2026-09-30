import pino from "pino";

const isTest =
  process.env.NODE_ENV === "test" ||
  process.env.VITEST === "true" ||
  Boolean(import.meta.env?.VITEST) ||
  import.meta.env?.MODE === "test";

// Fields to redact from logs for privacy and security
const redactFields = [
  "req.headers.authorization",
  "req.headers.cookie",
  // NOTE: req.headers.x-captcha-token contains hyphens and cannot be
  // expressed in fast-redact path notation.  The captcha token is already
  // covered by "captchaToken" and "body.captchaToken" paths.
  "plaintext",
  "secret",
  "privateKey",
  "unlockPrivateKey",
  "challengeSecret",
  "signedMessage",
  "wrappedKey",
  "encryptedPrompt",
  "encryptionIv",
  "keyBytes",
  "token",
  "captchaToken",
  "body.plaintext",
  "body.secret",
  "body.privateKey",
  "body.signedMessage",
  "body.wrappedKey",
  "body.encryptedPrompt",
  "body.encryptionIv",
  "body.keyBytes",
  "body.token",
  "body.captchaToken",
  "res.body.plaintext",
];

export const logger = pino({
  level: process.env.LOG_LEVEL || (isTest ? "silent" : "info"),
  redact: {
    paths: redactFields,
    censor: "[REDACTED]",
  },
  base: {
    env: process.env.NODE_ENV,
    service: "prompt-hash-unlock",
  },
});

export default logger;
