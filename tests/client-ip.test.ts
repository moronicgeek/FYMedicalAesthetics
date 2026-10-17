import { describe, expect, it } from "vitest";
import { ipFromForwardedFor } from "../src/lib/client-ip";

describe("visitor IP address", () => {
  it("ignores addresses the browser put in front of the real one", () => {
    expect(ipFromForwardedFor("1.2.3.4, 198.51.100.20")).toBe("198.51.100.20");
  });

  it("skips internal hops added after the proxy", () => {
    expect(ipFromForwardedFor("1.2.3.4, 198.51.100.20, 10.0.3.7, 172.31.0.2")).toBe("198.51.100.20");
    expect(ipFromForwardedFor("2001:db8::1, fd00::5")).toBe("2001:db8::1");
  });

  it("uses the last address when every hop is private, and nothing when there is none", () => {
    expect(ipFromForwardedFor("127.0.0.1")).toBe("127.0.0.1");
    expect(ipFromForwardedFor("not-an-ip")).toBeNull();
    expect(ipFromForwardedFor(null)).toBeNull();
  });
});
