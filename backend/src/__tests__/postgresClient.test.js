jest.mock("pg", () => ({ Pool: jest.fn(() => ({ on: jest.fn() })) }));

const { isConnectError, withConnectRetry } = require("../db/postgresClient");

describe("postgresClient connect retry", () => {
  it("recognises connect-phase errors only", () => {
    expect(isConnectError(new Error("Connection terminated due to connection timeout"))).toBe(true);
    expect(isConnectError(new Error("timeout exceeded when trying to connect"))).toBe(true);
    expect(isConnectError(Object.assign(new Error("x"), { code: "ECONNREFUSED" }))).toBe(true);
    expect(isConnectError(new Error("Connection terminated unexpectedly"))).toBe(false);
    expect(isConnectError(new Error('relation "x" does not exist'))).toBe(false);
  });

  it("retries a connect timeout and then succeeds", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("Connection terminated due to connection timeout"))
      .mockResolvedValue("ok");
    await expect(withConnectRetry(fn, 1)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("gives up after the retry limit", async () => {
    const fn = jest
      .fn()
      .mockRejectedValue(new Error("Connection terminated due to connection timeout"));
    await expect(withConnectRetry(fn, 1)).rejects.toThrow("connection timeout");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not retry non-connect errors", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("syntax error"));
    await expect(withConnectRetry(fn, 1)).rejects.toThrow("syntax error");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
