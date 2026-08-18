import { describe, expect, it } from "vitest";

import {
  atSpeed,
  behindBy,
  daysNeeded,
  finishDayKey,
  formatDuration,
  playlistStats,
} from "@/lib/playlist-maths";

const video = (durationSeconds: number, available = true) => ({ durationSeconds, available });

describe("playlist stats", () => {
  it("excludes unavailable videos from every total", () => {
    const stats = playlistStats([video(600), video(300), video(999, false)]);

    expect(stats.count).toBe(3);
    expect(stats.available).toBe(2);
    expect(stats.unavailable).toBe(1);
    expect(stats.totalSeconds).toBe(900);
    expect(stats.averageSeconds).toBe(450);
  });

  it("reports runtime at every speed", () => {
    const stats = playlistStats([video(3600)]);
    expect(stats.bySpeed.find((entry) => entry.speed === 2)?.seconds).toBe(1800);
    expect(stats.bySpeed.find((entry) => entry.speed === 1.5)?.seconds).toBe(2400);
  });

  it("survives an empty playlist", () => {
    const stats = playlistStats([]);
    expect(stats.totalSeconds).toBe(0);
    expect(stats.averageSeconds).toBe(0);
  });
});

describe("speeds and formatting", () => {
  it("divides runtime by speed", () => {
    expect(atSpeed(3600, 1.25)).toBe(2880);
  });

  it("formats sensibly", () => {
    expect(formatDuration(0)).toBe("0m");
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(750)).toBe("12m 30s");
    expect(formatDuration(15120)).toBe("4h 12m");
  });
});

describe("pace and finish date", () => {
  it("rounds part days up", () => {
    expect(daysNeeded(100, 3)).toBe(34);
    expect(daysNeeded(6, 2)).toBe(3);
  });

  it("counts today as the first day", () => {
    expect(finishDayKey("2026-08-17", 2, 2)).toBe("2026-08-17");
    expect(finishDayKey("2026-08-17", 4, 2)).toBe("2026-08-18");
  });

  it("returns null when the pace is zero", () => {
    expect(finishDayKey("2026-08-17", 10, 0)).toBeNull();
  });
});

describe("behind schedule", () => {
  it("is zero when on pace", () => {
    expect(
      behindBy({
        startDayKey: "2026-08-15",
        todayKey: "2026-08-17",
        perDay: 2,
        watched: 6,
        total: 100,
      }),
    ).toBe(0);
  });

  it("counts the backlog", () => {
    // Three days in at 2 a day expects 6; only 3 watched.
    expect(
      behindBy({
        startDayKey: "2026-08-15",
        todayKey: "2026-08-17",
        perDay: 2,
        watched: 3,
        total: 100,
      }),
    ).toBe(3);
  });

  it("never expects more than the playlist holds", () => {
    expect(
      behindBy({
        startDayKey: "2026-01-01",
        todayKey: "2026-08-17",
        perDay: 5,
        watched: 10,
        total: 10,
      }),
    ).toBe(0);
  });
});
