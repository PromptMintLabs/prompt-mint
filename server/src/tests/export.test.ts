import httpMocks from "node-mocks-http";
import { GenerateExportChallenge, RequestExport, DownloadExport } from "../controllers/exportController";
import User from "../models/User";
import Report from "../models/Report";
import Vote from "../models/Vote";
import Purchase from "../models/Purchase";
import WebhookSubscription from "../models/WebhookSubscription";
import { cacheSet, cacheGet, cacheDel } from "../services/cacheService";
import connectDb from "../db/connectDb";
import { Keypair } from "@stellar/stellar-sdk";

jest.mock("../models/User");
jest.mock("../models/Report");
jest.mock("../models/Vote");
jest.mock("../models/Purchase");
jest.mock("../models/WebhookSubscription");
jest.mock("../services/cacheService");
jest.mock("../db/connectDb");

// Helper to generate signature for tests
function createSignature(secretSeed: string, message: string) {
  const keypair = Keypair.fromSecret(secretSeed);
  return keypair.sign(Buffer.from(message, "utf8")).toString("base64");
}

describe("User Data Export", () => {
  const originalEnv = process.env;
  let testKeypair: Keypair;
  let testAddress: string;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...originalEnv, CHALLENGE_TOKEN_SECRET: "test-secret-that-is-long-enough-for-hmac" };
    (connectDb as jest.Mock).mockResolvedValue(true);
    testKeypair = Keypair.random();
    testAddress = testKeypair.publicKey();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("should generate an export challenge", () => {
    const req = httpMocks.createRequest({
      method: "POST",
      body: { address: testAddress }
    });
    const res = httpMocks.createResponse();

    GenerateExportChallenge(req, res);

    expect(res.statusCode).toBe(200);
    const data = res._getJSONData();
    expect(data.token).toBeDefined();
    expect(data.challenge).toBeDefined();
    expect(data.expiresAt).toBeDefined();
  });

  it("should handle empty exports", async () => {
    // 1. Get challenge
    const req1 = httpMocks.createRequest({ method: "POST", body: { address: testAddress } });
    const res1 = httpMocks.createResponse();
    GenerateExportChallenge(req1, res1);
    const { token, challenge } = res1._getJSONData();

    // 2. Sign challenge
    const signature = createSignature(testKeypair.secret(), challenge);

    const req = httpMocks.createRequest({
      method: "POST",
      body: { address: testAddress, signature, token }
    });
    const res = httpMocks.createResponse();

    (User.findOne as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    (Report.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    (Vote.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    (Purchase.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    (WebhookSubscription.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

    await RequestExport(req, res);

    expect(res.statusCode).toBe(200);
    const data = res._getJSONData();
    expect(data.success).toBe(true);
    expect(data.exportId).toBeDefined();

    // Verify cacheSet was called with empty data
    expect(cacheSet).toHaveBeenCalled();
    const callArgs = (cacheSet as jest.Mock).mock.calls[0];
    const cachedData = JSON.parse(callArgs[1]);
    expect(cachedData.data.profile).toBeNull();
    expect(cachedData.data.reports).toHaveLength(0);
  });

  it("should handle large exports", async () => {
    // 1. Get challenge
    const req1 = httpMocks.createRequest({ method: "POST", body: { address: testAddress } });
    const res1 = httpMocks.createResponse();
    GenerateExportChallenge(req1, res1);
    const { token, challenge } = res1._getJSONData();

    // 2. Sign challenge
    const signature = createSignature(testKeypair.secret(), challenge);

    const req = httpMocks.createRequest({
      method: "POST",
      body: { address: testAddress, signature, token }
    });
    const res = httpMocks.createResponse();

    const manyReports = Array(100).fill({ reason: "spam" });

    (User.findOne as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue({ username: "biguser" }) });
    (Report.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue(manyReports) });
    (Vote.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    (Purchase.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    (WebhookSubscription.find as jest.Mock).mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

    await RequestExport(req, res);

    expect(res.statusCode).toBe(200);
    const callArgs = (cacheSet as jest.Mock).mock.calls[0];
    const cachedData = JSON.parse(callArgs[1]);
    expect(cachedData.data.reports).toHaveLength(100);
  });

  it("should enforce wallet changes (reject invalid signature)", async () => {
    // 1. Get challenge
    const req1 = httpMocks.createRequest({ method: "POST", body: { address: testAddress } });
    const res1 = httpMocks.createResponse();
    GenerateExportChallenge(req1, res1);
    const { token, challenge } = res1._getJSONData();

    // 2. Sign with a DIFFERENT keypair
    const otherKeypair = Keypair.random();
    const signature = createSignature(otherKeypair.secret(), challenge);

    const req = httpMocks.createRequest({
      method: "POST",
      body: { address: testAddress, signature, token }
    });
    const res = httpMocks.createResponse();

    await RequestExport(req, res);

    expect(res.statusCode).toBe(401);
    expect(res._getJSONData().error).toBe("Invalid signature.");
  });

  it("should download export and handle expired links", async () => {
    // Valid link
    (cacheGet as jest.Mock).mockResolvedValue(JSON.stringify({ inventory: {}, data: {} }));
    let req = httpMocks.createRequest({ params: { exportId: "123" } });
    let res = httpMocks.createResponse();
    
    await DownloadExport(req, res);
    expect(res.statusCode).toBe(200);
    expect(cacheDel).toHaveBeenCalledWith("export:123");

    // Expired link (cacheGet returns null)
    (cacheGet as jest.Mock).mockResolvedValue(null);
    req = httpMocks.createRequest({ params: { exportId: "expired-id" } });
    res = httpMocks.createResponse();

    await DownloadExport(req, res);
    expect(res.statusCode).toBe(410);
    expect(res._getJSONData().error).toContain("expired");
  });
});
