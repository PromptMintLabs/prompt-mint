import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockBuildChallengeMessage,
  mockConnectDb,
  mockCreate,
  mockCreateChallengeToken,
  mockFind,
  mockVerifyChallengeSignature,
  mockVerifyChallengeToken,
} = vi.hoisted(() => ({
  mockBuildChallengeMessage: vi.fn(),
  mockConnectDb: vi.fn(),
  mockCreate: vi.fn(),
  mockCreateChallengeToken: vi.fn(),
  mockFind: vi.fn(),
  mockVerifyChallengeSignature: vi.fn(),
  mockVerifyChallengeToken: vi.fn(),
}));

vi.mock("../../src/lib/auth/challenge", () => ({
  buildChallengeMessage: mockBuildChallengeMessage,
  createChallengeToken: mockCreateChallengeToken,
  verifyChallengeSignature: mockVerifyChallengeSignature,
  verifyChallengeToken: mockVerifyChallengeToken,
}));
vi.mock("../../server/src/db/connectDb", () => ({ default: mockConnectDb }));
vi.mock("../../server/src/models/ReviewEditAuditLog", () => ({
  ReviewEditAuditLog: { create: mockCreate, find: mockFind },
}));

function createResponse() {
  const response: any = {
    headers: {} as Record<string, string>,
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      response.statusCode = code;
      return response;
    },
    setHeader(name: string, value: string) {
      response.headers[name] = value;
      return response;
    },
    json(body: unknown) {
      response.body = body;
      return response;
    },
    send(body: unknown) {
      response.body = body;
      return response;
    },
  };
  return response;
}

describe("Review edit audit", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("MODERATOR_ADDRESSES", "GADMIN123");
    vi.stubEnv("MOCK_SELLER_ADDRESS", "GSELLER123");
    vi.stubEnv("CHALLENGE_TOKEN_SECRET", "test-challenge-secret-123");
    mockConnectDb.mockResolvedValue(undefined);
    mockCreate.mockResolvedValue(undefined);
    mockCreateChallengeToken.mockReturnValue({
      token: "signed-token",
      challenge: "sign this export challenge",
      expiresAt: Date.now() + 60_000,
      nonce: "nonce",
    });
    mockVerifyChallengeToken.mockReturnValue({
      address: "GADMIN123",
      promptId: "review-audit-export",
      nonce: "nonce",
      expiresAt: Date.now() + 60_000,
    });
    mockBuildChallengeMessage.mockReturnValue("sign this export challenge");
    mockVerifyChallengeSignature.mockReturnValue(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("records previous and updated seller-response text before accepting an edit", async () => {
    const reviews = await import("../../api/reviews/data");
    reviews.updateReview("1", "review_1", {
      sellerResponse: { text: "Original response", createdAt: 100 },
    });
    const { default: handler } = await import("../../api/reviews/respond");
    const response = createResponse();

    await handler(
      {
        method: "POST",
        headers: {},
        body: {
          promptId: "1",
          reviewId: "review_1",
          sellerAddress: "GSELLER123",
          text: "Revised response",
        },
      },
      response
    );

    expect(mockCreate).toHaveBeenCalledWith({
      promptId: "1",
      reviewId: "review_1",
      editorAddress: "GSELLER123",
      previousText: "Original response",
      updatedText: "Revised response",
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      sellerResponse: { text: "Revised response", createdAt: 100 },
    });
  });

  it("exports edit history as an escaped CSV attachment for an authorized moderator", async () => {
    const records = [
      {
        createdAt: new Date("2026-01-02T03:04:05.000Z"),
        promptId: "prompt-1",
        reviewId: "review-1",
        editorAddress: "gseller123",
        previousText: 'old, "quoted" response',
        updatedText: "revised response",
      },
    ];
    const lean = vi.fn().mockResolvedValue(records);
    const sort = vi.fn().mockReturnValue({ lean });
    mockFind.mockReturnValue({ sort });
    const { default: handler } = await import("../../api/reviews/audit-export");
    const response = createResponse();

    await handler(
      {
        method: "POST",
        body: {
          address: "GADMIN123",
          token: "signed-token",
          signedMessage: "wallet-signature",
        },
      },
      response
    );

    expect(mockVerifyChallengeToken).toHaveBeenCalledWith(
      "test-challenge-secret-123",
      "signed-token",
      "GADMIN123",
      "review-audit-export"
    );
    expect(mockVerifyChallengeSignature).toHaveBeenCalledWith(
      "GADMIN123",
      "sign this export challenge",
      "wallet-signature"
    );
    expect(mockFind).toHaveBeenCalledWith({});
    expect(response.statusCode).toBe(200);
    expect(response.headers["Content-Type"]).toBe("text/csv; charset=utf-8");
    expect(response.headers["Content-Disposition"]).toContain("review-edit-audit.csv");
    expect(response.body).toContain('"old, ""quoted"" response"');
  });

  it("issues a signing challenge only to an allowlisted moderator", async () => {
    const { default: handler } = await import("../../api/reviews/audit-export-challenge");
    const response = createResponse();

    await handler({ method: "POST", body: { address: "GADMIN123" } }, response);

    expect(mockCreateChallengeToken).toHaveBeenCalledWith(
      "test-challenge-secret-123",
      "GADMIN123",
      "review-audit-export"
    );
    expect(response.statusCode).toBe(200);
  });

  it("rejects an export request when the wallet signature is invalid", async () => {
    mockVerifyChallengeSignature.mockReturnValue(false);
    const { default: handler } = await import("../../api/reviews/audit-export");
    const response = createResponse();

    await handler(
      {
        method: "POST",
        body: {
          address: "GADMIN123",
          token: "signed-token",
          signedMessage: "invalid-signature",
        },
      },
      response
    );

    expect(response.statusCode).toBe(401);
    expect(mockFind).not.toHaveBeenCalled();
  });

  it("disables export when no moderator allowlist is configured", async () => {
    vi.stubEnv("MODERATOR_ADDRESSES", "");
    const { default: handler } = await import("../../api/reviews/audit-export");
    const response = createResponse();

    await handler(
      {
        method: "POST",
        body: {
          address: "GADMIN123",
          token: "signed-token",
          signedMessage: "wallet-signature",
        },
      },
      response
    );

    expect(response.statusCode).toBe(503);
    expect(response.body).toEqual({ error: "Review edit audit export is not configured" });
    expect(mockConnectDb).not.toHaveBeenCalled();
  });
});
