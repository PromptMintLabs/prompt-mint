import { AppError } from "../lib/AppError";
import { asyncRoute } from "../lib/asyncRoute";

describe("AppError", () => {
  it("creates an error with message, status, and optional code", () => {
    const err = new AppError("Not found", 404, "NOT_FOUND");
    expect(err.message).toBe("Not found");
    expect(err.httpStatus).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.name).toBe("AppError");
  });

  it("creates an error without a code", () => {
    const err = new AppError("Server error", 500);
    expect(err.message).toBe("Server error");
    expect(err.httpStatus).toBe(500);
    expect(err.code).toBeUndefined();
  });
});

describe("asyncRoute", () => {
  it("catches thrown errors and passes them to next", async () => {
    const next = jest.fn();
    const req = {} as any;
    const res = {} as any;

    const handler = asyncRoute(async () => {
      throw new Error("async error");
    });

    await handler(req, res, next);
    expect(next).toHaveBeenCalledWith(new Error("async error"));
  });

  it("passes successful handlers through", async () => {
    const next = jest.fn();
    const req = {} as any;
    const res = {} as any;
    const result: any[] = [];

    const handler = asyncRoute(async (_req, _res) => {
      result.push("done");
    });

    await handler(req, res, next);
    expect(result).toEqual(["done"]);
    expect(next).not.toHaveBeenCalled();
  });
});
