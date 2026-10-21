import { afterEach, describe, expect, it, vi } from "vitest";
import { canEnterPaperHistory, canRemovePaperHistory, canSeePaperEntry } from "../src/lib/access";
import { paperDate, paperEntrySchema, sortPaperEntries, toPaperEntry, type PaperEntry } from "../src/lib/paper-history";

const parse = (v: Record<string, string>) => paperEntrySchema.safeParse(v);

describe("paper history form", () => {
  afterEach(() => vi.useRealTimers());

  it("needs what the paper file says and what kind of entry it is", () => {
    expect(parse({ kind: "visit", notes: "  " }).success).toBe(false);
    expect(parse({ notes: "Botox 20 units forehead" }).success).toBe(false);
    expect(parse({ kind: "visit", notes: "Botox 20 units forehead" }).success).toBe(true);
  });

  it("refuses a kind it doesn't know", () => {
    expect(parse({ kind: "appointment", notes: "x" }).success).toBe(false);
  });

  it("allows the date to be left blank when the file doesn't show one", () => {
    const r = parse({ kind: "medical", date: "", notes: "Allergic to penicillin" });
    expect(r.success && toPaperEntry(r.data)).toEqual({ kind: "medical", notes: "Allergic to penicillin" });
  });

  it("refuses a date in the future, before 1900 or not a real date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-21T10:00:00Z"));
    expect(parse({ kind: "visit", date: "2026-10-22", notes: "x" }).success).toBe(false);
    expect(parse({ kind: "visit", date: "1899-12-31", notes: "x" }).success).toBe(false);
    expect(parse({ kind: "visit", date: "21/10/2019", notes: "x" }).success).toBe(false);
    expect(parse({ kind: "visit", date: "2026-10-21", notes: "x" }).success).toBe(true);
  });

  it("goes by the clinic's date, not the server's, just after midnight", () => {
    vi.useFakeTimers();
    // 00:30 on 22 October in Johannesburg is still 21 October in UTC.
    vi.setSystemTime(new Date("2026-10-21T22:30:00Z"));
    expect(parse({ kind: "visit", date: "2026-10-22", notes: "x" }).success).toBe(true);
  });

  it("keeps long notes to one entry's worth", () => {
    expect(parse({ kind: "note", notes: "a".repeat(4000) }).success).toBe(true);
    expect(parse({ kind: "note", notes: "a".repeat(4001) }).success).toBe(false);
    expect(parse({ kind: "visit", treatment: "a".repeat(201), notes: "x" }).success).toBe(false);
  });

  it("saves trimmed values and leaves out blank optional fields", () => {
    const r = parse({ kind: "visit", date: "2019-03-03", treatment: " Filler ", treatedBy: "", notes: " 1ml lips \n" });
    expect(r.success && toPaperEntry(r.data)).toEqual({ kind: "visit", date: "2019-03-03", treatment: "Filler", notes: "1ml lips" });
  });
});

describe("paper history order", () => {
  const item = (date: string | undefined, typedAt: string) => ({ entry: { kind: "visit", date, notes: "x" } as PaperEntry, createdAt: new Date(typedAt) });

  it("puts the newest date on the file first and undated entries last, in the order typed", () => {
    const a = item("2018-05-01", "2026-10-21T10:00:00Z");
    const b = item(undefined, "2026-10-21T10:01:00Z");
    const c = item("2020-01-15", "2026-10-21T10:02:00Z");
    const d = item(undefined, "2026-10-21T10:00:30Z");
    expect(sortPaperEntries([a, b, c, d])).toEqual([c, a, d, b]);
  });

  it("keeps the order typed for entries with the same date", () => {
    const a = item("2019-01-01", "2026-10-21T10:05:00Z");
    const b = item("2019-01-01", "2026-10-21T10:01:00Z");
    expect(sortPaperEntries([a, b])).toEqual([b, a]);
  });
});

describe("paper history dates", () => {
  it("shows the date as written, without shifting it a day", () => {
    expect(paperDate("2019-03-03")).toBe("3 March 2019");
    expect(paperDate(undefined)).toBe("Date not on file");
  });
});

describe("who works with paper history", () => {
  it("lets reception and admins add and correct entries, nobody else", () => {
    expect(canEnterPaperHistory("RECEPTION")).toBe(true);
    expect(canEnterPaperHistory("ADMIN")).toBe(true);
    expect(canEnterPaperHistory("DOCTOR")).toBe(false);
    expect(canEnterPaperHistory("PRACTITIONER")).toBe(false);
  });

  it("only lets admins remove an entry", () => {
    expect(canRemovePaperHistory("ADMIN")).toBe(true);
    expect(canRemovePaperHistory("RECEPTION")).toBe(false);
    expect(canRemovePaperHistory("DOCTOR")).toBe(false);
  });

  it("shows practitioners medical history from paper, but not past visits or notes", () => {
    expect(canSeePaperEntry("PRACTITIONER", "medical")).toBe(true);
    expect(canSeePaperEntry("PRACTITIONER", "visit")).toBe(false);
    expect(canSeePaperEntry("PRACTITIONER", "note")).toBe(false);
    for (const role of ["ADMIN", "DOCTOR", "RECEPTION"] as const) {
      for (const kind of ["visit", "medical", "note"]) expect(canSeePaperEntry(role, kind)).toBe(true);
    }
  });
});
