import { describe, expect, it } from "vitest";

import {
  dateToDayKey,
  dayKeyFor,
  dayKeyRange,
  dayKeyToDate,
  daysBetween,
  dayTypeFor,
  hhmmFromMinutes,
  isValidDayKey,
  isValidTimezone,
  isWakeOnTime,
  minutesFromHHmm,
  shiftDayKey,
  taskAppliesOn,
} from "@/lib/time";

describe("local day keys", () => {
  it("uses the user's timezone, not UTC", () => {
    // 20:30 UTC is already the next calendar day in Kolkata.
    const instant = new Date("2026-08-13T20:30:00.000Z");
    expect(dayKeyFor(instant, "Asia/Kolkata")).toBe("2026-08-14");
    expect(dayKeyFor(instant, "UTC")).toBe("2026-08-13");
    expect(dayKeyFor(instant, "America/Los_Angeles")).toBe("2026-08-13");
  });

  it("handles the other side of midnight", () => {
    // 01:30 local in Kolkata is still the previous UTC day.
    const instant = new Date("2026-08-13T20:00:00.000Z");
    expect(dayKeyFor(instant, "Asia/Kolkata")).toBe("2026-08-14");
  });

  it("round-trips through the database representation", () => {
    expect(dateToDayKey(dayKeyToDate("2024-02-29"))).toBe("2024-02-29"); // leap day
    expect(dateToDayKey(dayKeyToDate("2026-12-31"))).toBe("2026-12-31");
    expect(dateToDayKey(dayKeyToDate("2026-01-01"))).toBe("2026-01-01");
  });

  it("shifts across month and year ends", () => {
    expect(shiftDayKey("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDayKey("2026-02-28", 1)).toBe("2026-03-01");
    expect(daysBetween("2025-12-25", "2026-01-01")).toBe(7);
  });

  it("builds inclusive ranges", () => {
    expect(dayKeyRange("2026-03-01", "2026-03-03")).toEqual([
      "2026-03-01",
      "2026-03-02",
      "2026-03-03",
    ]);
  });

  it("validates day keys", () => {
    expect(isValidDayKey("2026-08-13")).toBe(true);
    expect(isValidDayKey("13-08-2026")).toBe(false);
    expect(isValidDayKey("")).toBe(false);
  });
});

describe("day types", () => {
  it("identifies weekend days", () => {
    expect(dayTypeFor("2026-08-15")).toBe("SATURDAY");
    expect(dayTypeFor("2026-08-16")).toBe("SUNDAY");
    expect(dayTypeFor("2026-08-13")).toBe("WEEKDAY");
  });

  it("applies DAILY tasks everywhere", () => {
    expect(taskAppliesOn({ dayType: "DAILY" }, "2026-08-16")).toBe(true);
    expect(taskAppliesOn({ dayType: "WEEKDAY" }, "2026-08-16")).toBe(false);
    expect(taskAppliesOn({ dayType: "SUNDAY" }, "2026-08-16")).toBe(true);
  });

  it("lands a one-off task on its date only", () => {
    const task = { dayType: "ONE_OFF" as const, scheduledDate: dayKeyToDate("2026-08-20") };
    expect(taskAppliesOn(task, "2026-08-20")).toBe(true);
    expect(taskAppliesOn(task, "2026-08-19")).toBe(false);
    expect(taskAppliesOn({ dayType: "ONE_OFF" as const, scheduledDate: null }, "2026-08-20")).toBe(
      false,
    );
  });
});

describe("wake times", () => {
  it("converts both ways", () => {
    expect(minutesFromHHmm("04:15")).toBe(255);
    expect(hhmmFromMinutes(255)).toBe("04:15");
  });

  it("counts early and within grace as on time", () => {
    expect(isWakeOnTime("03:45", "04:00")).toBe(true);
    expect(isWakeOnTime("04:00", "04:00")).toBe(true);
    expect(isWakeOnTime("04:15", "04:00")).toBe(true);
    expect(isWakeOnTime("04:16", "04:00")).toBe(false);
  });
});

describe("timezone validation", () => {
  it("rejects nonsense", () => {
    expect(isValidTimezone("Asia/Kolkata")).toBe(true);
    expect(isValidTimezone("Mars/Olympus")).toBe(false);
  });
});
