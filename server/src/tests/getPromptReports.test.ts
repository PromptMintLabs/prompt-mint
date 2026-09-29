import httpMocks from "node-mocks-http";
import { GetPromptReports, SubmitPromptReport } from "../controllers/controllers";
import Report from "../models/Report";
import Prompt from "../models/Prompt";
import connectDb from "../db/connectDb";

jest.mock("../models/User");
jest.mock("../models/Prompt");
jest.mock("../models/Report");
jest.mock("../db/connectDb");
jest.mock("../services/cacheService");

describe("GetPromptReports admin authentication", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...originalEnv, ADMIN_API_TOKEN: "the-real-admin-token" };
    (connectDb as jest.Mock).mockResolvedValue(true);
    (Report.find as jest.Mock).mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("rejects requests with no Authorization header", async () => {
    const req = httpMocks.createRequest({ method: "GET", url: "http://localhost/api/user/reports" });
    const res = httpMocks.createResponse();

    await GetPromptReports(req, res);

    expect(res.statusCode).toBe(401);
    expect(res._getJSONData().message).toContain("admin token");
  });

  it("rejects requests bearing an arbitrary truthy token (regression: previously any token was accepted)", async () => {
    const req = httpMocks.createRequest({
      method: "GET",
      url: "http://localhost/api/user/reports",
      headers: { authorization: "Bearer literally-anything" },
    });
    const res = httpMocks.createResponse();

    await GetPromptReports(req, res);

    expect(res.statusCode).toBe(401);
  });

  it("rejects requests when ADMIN_API_TOKEN is not configured, even with a well-formed header", async () => {
    delete process.env.ADMIN_API_TOKEN;
    const req = httpMocks.createRequest({
      method: "GET",
      url: "http://localhost/api/user/reports",
      headers: { authorization: "Bearer the-real-admin-token" },
    });
    const res = httpMocks.createResponse();

    await GetPromptReports(req, res);

    expect(res.statusCode).toBe(401);
  });

  it("accepts requests bearing the correct admin token", async () => {
    const req = httpMocks.createRequest({
      method: "GET",
      url: "http://localhost/api/user/reports",
      headers: { authorization: "Bearer the-real-admin-token" },
    });
    const res = httpMocks.createResponse();

    await GetPromptReports(req, res);

    expect(res.statusCode).toBe(200);
  });

  it("returns the captured listing snapshot to investigators", async () => {
    const listingSnapshot = {
      promptId: "prompt_1",
      capturedAt: new Date("2026-09-28T12:00:00.000Z"),
      title: "Reported listing",
      category: "Programming",
      price: 5,
      tags: ["arch"],
    };
    (Report.find as jest.Mock).mockReturnValue({
      sort: jest.fn().mockResolvedValue([
        { _id: "rep_1", promptId: "prompt_1", reason: "plagiarism", listingSnapshot },
      ]),
    });

    const req = httpMocks.createRequest({
      method: "GET",
      url: "http://localhost/api/user/reports",
      headers: { authorization: "Bearer the-real-admin-token" },
    });
    const res = httpMocks.createResponse();

    await GetPromptReports(req, res);

    expect(res.statusCode).toBe(200);
    const body = res._getJSONData() as Array<{ listingSnapshot?: { title?: string } }>;
    expect(body).toHaveLength(1);
    expect(body[0].listingSnapshot).toMatchObject({ promptId: "prompt_1", title: "Reported listing" });
  });
});

describe("SubmitPromptReport deduplication", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (connectDb as jest.Mock).mockResolvedValue(true);
    (Prompt.findById as jest.Mock).mockResolvedValue({ _id: "prompt-1" });
  });

  it("returns the existing active report for the same reporter, prompt, and reason", async () => {
    const existingReport = { _id: "existing-report" };
    (Report.findOne as jest.Mock).mockResolvedValue(existingReport);
    const req = httpMocks.createRequest({
      method: "POST",
      url: "http://localhost/api/prompts/report",
      body: {
        promptId: "prompt-1",
        reporterAddress: "GREPORTER",
        reason: "plagiarism",
        description: "Repeated report text",
      },
    });
    const res = httpMocks.createResponse();

    await SubmitPromptReport(req, res);

    expect(Report.findOne).toHaveBeenCalledWith({
      promptId: "prompt-1",
      reporterAddress: "greporter",
      reason: "plagiarism",
      status: { $in: ["pending", "investigating"] },
    });
    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toMatchObject({
      success: true,
      duplicate: true,
      reportId: "existing-report",
    });
  });

  it("creates a separate report from a different reporter for the same prompt and reason", async () => {
    (Report.findOne as jest.Mock).mockResolvedValue(null);
    const save = jest.fn().mockResolvedValue(undefined);
    (Report as unknown as jest.Mock).mockImplementation(function (this: any, report: Record<string, unknown>) {
      Object.assign(this, report, { _id: "new-report", save });
    });
    const req = httpMocks.createRequest({
      method: "POST",
      url: "http://localhost/api/prompts/report",
      body: {
        promptId: "prompt-1",
        reporterAddress: "GOTHERREPORTER",
        reason: "plagiarism",
        description: "A separate concern",
      },
    });
    const res = httpMocks.createResponse();

    await SubmitPromptReport(req, res);

    expect(Report.findOne).toHaveBeenCalledWith({
      promptId: "prompt-1",
      reporterAddress: "gotherreporter",
      reason: "plagiarism",
      status: { $in: ["pending", "investigating"] },
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(201);
    expect(res._getJSONData()).toMatchObject({ success: true, reportId: "new-report" });
  });
});
