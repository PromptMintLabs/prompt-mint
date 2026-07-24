import { withObservability } from "../../src/lib/observability/wrapper";
import { apiError, ErrorCode } from "../../src/lib/api/errorCodes";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json(apiError(ErrorCode.METHOD_NOT_ALLOWED, "Method not allowed."));
  }

  const { url } = req.body;
  if (!url || typeof url !== "string" || !/^https?:\/\/.+/i.test(url)) {
    return res.status(400).json(apiError(ErrorCode.INVALID_INPUT, "A valid image URL is required."));
  }

  try {
    // We use a HEAD request first to save bandwidth
    let headRes = await fetch(url, { method: "HEAD", headers: { "User-Agent": "PromptMintValidator/1.0" } });
    
    // Some servers block HEAD requests, if so fallback to a GET with a range
    if (headRes.status === 405 || headRes.status === 403) {
      headRes = await fetch(url, { method: "GET", headers: { "Range": "bytes=0-0", "User-Agent": "PromptMintValidator/1.0" } });
    }

    if (!headRes.ok) {
      return res.status(400).json(apiError(ErrorCode.INVALID_INPUT, `Failed to fetch image: HTTP ${headRes.status}`));
    }

    const contentType = headRes.headers.get("content-type");
    if (!contentType || !ALLOWED_MIME_TYPES.some(type => contentType.toLowerCase().includes(type))) {
      return res.status(400).json(apiError(ErrorCode.INVALID_INPUT, `Unsupported content type: ${contentType}. Must be JPEG, PNG, WebP, or GIF.`));
    }

    const contentLength = headRes.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_BYTES) {
      return res.status(400).json(apiError(ErrorCode.INVALID_INPUT, `Image is too large. Max size is 5MB.`));
    }

    return res.status(200).json({ valid: true, contentType, contentLength });
  } catch (error: any) {
    if (req.logger?.error) {
      req.logger.error({ err: error.message }, "Error validating image URL");
    } else {
      console.error("Error validating image URL", error.message);
    }
    return res.status(500).json(apiError(ErrorCode.TEMPORARY_FAILURE, "Failed to reach the remote image URL."));
  }
}

export default withObservability(handler, "image_validate");
