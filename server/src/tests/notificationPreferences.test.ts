import httpMocks from "node-mocks-http";
import { UpdateUserPreferences } from "../controllers/controllers";
import connectDb from "../db/connectDb";
import User from "../models/User";

jest.mock("../models/User");
jest.mock("../models/Prompt");
jest.mock("../models/Report");
jest.mock("../db/connectDb");
jest.mock("../services/cacheService");

describe("weekly creator digest preferences", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (connectDb as jest.Mock).mockResolvedValue(true);
  });

  it("requires an email address to enable the digest", async () => {
    (User.findOne as jest.Mock).mockResolvedValue(null);
    const req = httpMocks.createRequest({
      method: "PUT",
      body: {
        walletAddress: "GCREATOR",
        preferences: { weeklyCreatorDigest: true },
      },
    });
    const res = httpMocks.createResponse();

    await UpdateUserPreferences(req, res);

    expect(res.statusCode).toBe(400);
    expect(res._getJSONData().message).toMatch(/email address/i);
  });

  it("keeps the saved email when enabling the digest through a partial update", async () => {
    const user = {
      email: "creator@example.com",
      notificationPreferences: { weeklyCreatorDigest: false },
      save: jest.fn().mockResolvedValue(undefined),
    };
    (User.findOne as jest.Mock).mockResolvedValue(user);
    const req = httpMocks.createRequest({
      method: "PUT",
      body: {
        walletAddress: "GCREATOR",
        preferences: { weeklyCreatorDigest: true },
      },
    });
    const res = httpMocks.createResponse();

    await UpdateUserPreferences(req, res);

    expect(user.save).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toMatchObject({ emailAddress: "creator@example.com" });
  });

  it("does not allow clearing an email while leaving an existing digest enabled", async () => {
    const user = {
      email: "creator@example.com",
      notificationPreferences: { weeklyCreatorDigest: true },
      save: jest.fn(),
    };
    (User.findOne as jest.Mock).mockResolvedValue(user);
    const req = httpMocks.createRequest({
      method: "PUT",
      body: {
        walletAddress: "GCREATOR",
        emailAddress: "",
        preferences: {},
      },
    });
    const res = httpMocks.createResponse();

    await UpdateUserPreferences(req, res);

    expect(res.statusCode).toBe(400);
    expect(user.save).not.toHaveBeenCalled();
  });
});