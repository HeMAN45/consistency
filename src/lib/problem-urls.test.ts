import { describe, expect, it } from "vitest";

import { normaliseTopics, parseProblemList, parseProblemUrl } from "@/lib/problem-urls";

describe("parsing problem links", () => {
  it("reads a LeetCode problem", () => {
    const parsed = parseProblemUrl("https://leetcode.com/problems/two-sum/");
    expect(parsed?.platform).toBe("LEETCODE");
    expect(parsed?.title).toBe("Two Sum");
  });

  it("names a Codeforces problem by contest and index", () => {
    const parsed = parseProblemUrl("https://codeforces.com/problemset/problem/4/A");
    expect(parsed?.platform).toBe("CODEFORCES");
    expect(parsed?.title).toBe("Codeforces 4A");
  });

  it("falls back to Other for unknown hosts", () => {
    const parsed = parseProblemUrl("https://example.com/puzzles/hard-one");
    expect(parsed?.platform).toBe("OTHER");
    expect(parsed?.title).toBe("Hard One");
  });

  it("strips query strings and trailing slashes so duplicates collapse", () => {
    const a = parseProblemUrl("https://leetcode.com/problems/two-sum/?envType=daily");
    const b = parseProblemUrl("https://leetcode.com/problems/two-sum");
    expect(a?.url).toBe(b?.url);
  });

  it("rejects nonsense", () => {
    expect(parseProblemUrl("not a link")).toBeNull();
    expect(parseProblemUrl("")).toBeNull();
  });
});

describe("bulk paste", () => {
  it("takes one per line and drops duplicates", () => {
    const list = parseProblemList(`
      https://leetcode.com/problems/two-sum/
      https://leetcode.com/problems/two-sum
      https://codeforces.com/problemset/problem/4/A

      rubbish
    `);

    expect(list).toHaveLength(2);
  });
});

describe("topics", () => {
  it("lowercases, dedupes and caps", () => {
    expect(normaliseTopics("Arrays, arrays, DP , graphs")).toEqual(["arrays", "dp", "graphs"]);
  });

  it("ignores empties", () => {
    expect(normaliseTopics(" , , ")).toEqual([]);
  });
});
