const { scrubEvent, initSentry, isEnabled } = require("../utils/sentry");

describe("sentry scrubbing", () => {
  it("redacts credentials in connection strings from messages and exceptions", () => {
    const event = scrubEvent({
      message: "failed postgresql://user:s3cret@host.neon.tech/db",
      exception: { values: [{ value: "connect error postgres://u:pw@h:5432/x" }] },
    });
    expect(event.message).toBe("failed postgresql://[redacted]@host.neon.tech/db");
    expect(event.exception.values[0].value).toBe("connect error postgres://[redacted]@h:5432/x");
  });

  it("removes cookies, auth headers, query strings, request bodies and IPs", () => {
    const event = scrubEvent({
      request: {
        cookies: { a: "b" },
        data: { x: 1 },
        query_string: "q=1",
        url: "https://api.example.com/api/rankings?category=pts&q=1",
        headers: {
          Authorization: "Bearer x",
          Cookie: "a=b",
          "CF-Connecting-IP": "9.9.9.9",
          "x-forwarded-for": "9.9.9.9, 1.1.1.1",
          "user-agent": "jest",
        },
      },
      user: { ip_address: "1.2.3.4" },
    });
    expect(event.request.cookies).toBeUndefined();
    expect(event.request.data).toBeUndefined();
    expect(event.request.query_string).toBeUndefined();
    expect(event.request.url).toBe("https://api.example.com/api/rankings");
    expect(event.request.headers).toEqual({ "user-agent": "jest" });
    expect(event.user.ip_address).toBeUndefined();
  });

  it("stays disabled without a DSN", () => {
    expect(initSentry()).toBe(false);
    expect(isEnabled()).toBe(false);
  });
});
