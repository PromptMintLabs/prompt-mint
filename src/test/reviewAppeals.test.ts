import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockBuildChallengeMessage,
  mockConnectDb,
  mockCreate,
  mockCreateChallengeToken,
  mockVerifyChallengeSignature,
  mockVerifyChallengeToken,
} = vi.hoisted(() => ({
  mockBuildChallengeMessage: vi.fn(),
  mockConnectDb: vi.fn(),
  mockCreate: vi.fn(),
  mockCreateChallengeToken: vi.fn(),
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
vi.mock("../../server/src/models/Appeal", () => ({ Appeal: { create: mockCreate } }));

function createResponse() {
  const response: any = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      response.statusCode = code;
      return response;
    },
    json(body: unknown) {
      response.body = body;
      return response;
    },
  };
  return response;
}

const appellantAddress = "GBCD234ABC567EFG890HIJ123KLM456NOP789QRS012TUV345WXY678ZA";
const pdfData = Buffer.from("%PDF-1.7 appeal evidence");

function validSubmission(attachments = [{
  name: "evidence.pdf",
  size: pdfData.length,
  content: pdfData.toString("base64"),
}]) {
  return {
    method: "POST",
    body: {
      address: appellantAddress,
      reviewId: "review_2",
      reason: "The review was removed in error and I can provide more context.",
      token: "appeal-token",
      signedMessage: "wallet-signature",
      attachments,
    },
  };
}

describe("Review appeal API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("CHALLENGE_TOKEN_SECRET", "test-challenge-secret-123");
    mockConnectDb.mockResolvedValue(undefined);
    mockCreate.mockResolvedValue(undefined);
    mockCreateChallengeToken.mockReturnValue({
      token: "appeal-token",
      challenge: "sign this appeal request",
      expiresAt: Date.now() + 60_000,
      nonce: "appeal-nonce",
    });
    mockVerifyChallengeToken.mockReturnValue({
      address: appellantAddress,
      promptId: "review-appeal:review_2",
      nonce: "appeal-nonce",
      expiresAt: Date.now() + 60_000,
    });
    mockBuildChallengeMessage.mockReturnValue("sign this appeal request");
    mockVerifyChallengeSignature.mockReturnValue(true);
  });

  it("issues a challenge for the owner of a moderated review", async () => {
    const { default: handler } = await import("../../api/reviews/appeal-challenge");
    const response = createResponse();

    await handler({ method: "POST", body: { address: appellantAddress, reviewId: "review_2" } }, response);

    expect(response.statusCode).toBe(200);
    expect(mockCreateChallengeToken).toHaveBeenCalledWith(
      "test-challenge-secret-123",
      appellantAddress,
      "review-appeal:review_2"
    );
  });

  it("rejects a challenge request from someone other than the review author", async () => {
    const { default: handler } = await import("../../api/reviews/appeal-challenge");
    const response = createResponse();

    await handler({ method: "POST", body: { address: "GNOTTHEAUTHOR", reviewId: "review_2" } }, response);

    expect(response.statusCode).toBe(404);
    expect(mockCreateChallengeToken).not.toHaveBeenCalled();
  });

  it("stores a signed appeal and supporting file bytes", async () => {
    const { default: handler } = await import("../../api/reviews/appeals");
    const response = createResponse();

    await handler(validSubmission(), response);

    expect(mockVerifyChallengeToken).toHaveBeenCalledWith(
      "test-challenge-secret-123",
      "appeal-token",
      appellantAddress,
      "review-appeal:review_2"
    );
    expect(mockVerifyChallengeSignature).toHaveBeenCalledWith(
      appellantAddress,
      "sign this appeal request",
      "wallet-signature"
    );
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      decisionId: null,
      reviewId: "review_2",
      appellantAddress: appellantAddress.toLowerCase(),
      statement: "The review was removed in error and I can provide more context.",
      status: "open",
      attachments: [{
        name: "evidence.pdf",
        contentType: "application/pdf",
        size: pdfData.length,
        data: pdfData,
      }],
      history: [expect.objectContaining({ toStatus: "open", actor: appellantAddress.toLowerCase() })],
    }));
    expect(response.statusCode).toBe(201);
    expect(response.body).toMatchObject({ reviewId: "review_2", status: "submitted" });
  });

  it("rejects an invalid signature without writing the appeal", async () => {
    mockVerifyChallengeSignature.mockReturnValue(false);
    const { default: handler } = await import("../../api/reviews/appeals");
    const response = createResponse();

    await handler(validSubmission([]), response);

    expect(response.statusCode).toBe(401);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects unsupported supporting file content", async () => {
    const { default: handler } = await import("../../api/reviews/appeals");
    const response = createResponse();

    await handler(validSubmission([{
      name: "script.bin",
      size: 3,
      content: Buffer.from([0, 1, 2]).toString("base64"),
    }]), response);

    expect(response.statusCode).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
