import type { Difficulty, Platform } from "@prisma/client";

/**
 * Reading a problem from its URL.
 *
 * Pure and dependency-free so it can be tested. Nothing is scraped: the title
 * comes from the URL's own slug, which is why LeetCode gives a clean name and a
 * Codeforces problem gives its contest number. Difficulty is never guessed,
 * because a wrong guess is worse than no answer.
 */

export type ParsedProblem = {
  url: string;
  platform: Platform;
  title: string;
};

const HOSTS: { match: RegExp; platform: Platform }[] = [
  { match: /(^|\.)leetcode\.com$/i, platform: "LEETCODE" },
  { match: /(^|\.)codeforces\.com$/i, platform: "CODEFORCES" },
  { match: /(^|\.)geeksforgeeks\.org$/i, platform: "GEEKSFORGEEKS" },
  { match: /(^|\.)hackerrank\.com$/i, platform: "HACKERRANK" },
  { match: /(^|\.)codechef\.com$/i, platform: "CODECHEF" },
  { match: /(^|\.)atcoder\.jp$/i, platform: "ATCODER" },
];

export const PLATFORM_LABELS: Record<Platform, string> = {
  LEETCODE: "LeetCode",
  CODEFORCES: "Codeforces",
  GEEKSFORGEEKS: "GeeksforGeeks",
  HACKERRANK: "HackerRank",
  CODECHEF: "CodeChef",
  ATCODER: "AtCoder",
  OTHER: "Other",
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
};

function titleCase(slug: string) {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function parseProblemUrl(input: string): ParsedProblem | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  /*
   * `new URL("https://rubbish")` parses happily, so a bare word would otherwise
   * be saved as a problem. A real host has a dot and no spaces.
   */
  if (!url.hostname.includes(".") || /\s/.test(url.hostname)) return null;

  const platform = HOSTS.find((host) => host.match.test(url.hostname))?.platform ?? "OTHER";
  const segments = url.pathname.split("/").filter(Boolean);

  let title = "";

  if (platform === "CODEFORCES") {
    // /problemset/problem/4/A and /contest/4/problem/A both end in contest + index.
    const index = segments[segments.length - 1];
    const contest = segments[segments.length - 2];
    title = contest && index ? `Codeforces ${contest}${index.toUpperCase()}` : "Codeforces problem";
  } else {
    const slug =
      segments.find((segment, i) => segments[i - 1] === "problems") ??
      segments[segments.length - 1] ??
      "";
    title = titleCase(slug);
  }

  if (!title) title = url.hostname;

  // Strip tracking and anchors: the same problem shouldn't be saved twice.
  const clean = `${url.origin}${url.pathname.replace(/\/$/, "")}`;

  return { url: clean, platform, title: title.slice(0, 120) };
}

/** One URL per line, blanks and duplicates removed. */
export function parseProblemList(input: string): ParsedProblem[] {
  const seen = new Set<string>();
  const out: ParsedProblem[] = [];

  for (const line of input.split(/[\n,]/)) {
    const parsed = parseProblemUrl(line);
    if (!parsed || seen.has(parsed.url)) continue;
    seen.add(parsed.url);
    out.push(parsed);
  }

  return out;
}

export function normaliseTopics(input: string): string[] {
  return [
    ...new Set(
      input
        .split(",")
        .map((topic) => topic.trim().toLowerCase())
        .filter((topic) => topic.length > 0 && topic.length <= 24),
    ),
  ].slice(0, 8);
}
