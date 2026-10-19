import { describe, expect, it } from "vitest";
import { deviceLabel, problemSchema, screenPath } from "../src/lib/problem-reports";

describe("problem report screen path", () => {
  it("keeps plain screen names", () => {
    expect(screenPath("/appointments")).toBe("/appointments");
    expect(screenPath("/patients/new")).toBe("/patients/new");
  });

  it("hides record IDs, numbers and the query string", () => {
    expect(screenPath("/patients/clx9example0001abcd/edit?tab=history")).toBe("/patients/:id/edit");
    expect(screenPath("/cases/4821#notes")).toBe("/cases/:id");
    expect(screenPath("/kiosk/sign/abc123")).toBe("/kiosk/sign/:id");
  });

  it("refuses anything that isn't a path on this site", () => {
    expect(screenPath("https://example.com/x")).toBe("/");
    expect(screenPath("//example.com/x")).toBe("/");
    expect(screenPath(undefined)).toBe("/");
  });
});

describe("problem report device", () => {
  it("names the browser, system and screen size", () => {
    const ua = "Mozilla/5.0 (Linux; Android 14; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
    expect(deviceLabel(ua, "1280×800")).toBe("Chrome 141 on Android · 1280×800");
  });

  it("ignores a screen size that isn't one", () => {
    expect(deviceLabel("", "<b>")).toBeUndefined();
  });
});

describe("problem report form", () => {
  it("needs what went wrong", () => {
    expect(problemSchema.safeParse({ whatHappened: "  " }).success).toBe(false);
    expect(problemSchema.safeParse({ whatHappened: "The Save button did nothing" }).success).toBe(true);
  });
});
