"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * The signature element. The product is named `~/consistency` because it should
 * feel like a command you run daily — so the page opens by running it.
 */
const SCRIPT: { prompt?: boolean; text: string; tone?: "ok" | "dim" | "amber" }[] = [
  { prompt: true, text: "consistency init" },
  { text: "reading 90 days of history…", tone: "dim" },
  { text: "core tasks    8 / 8        ✓ perfect day", tone: "ok" },
  { text: "streak        27 days", tone: "amber" },
  { text: "rating        1284         EXPERT", tone: "amber" },
  { text: "consistency   87 / 100     ↑ 12% this week", tone: "ok" },
  { prompt: true, text: "focus dsa 90" },
  { text: "session running. nothing else on screen.", tone: "dim" },
];

const TYPE_MS = 34;
const LINE_PAUSE = 260;

export function TerminalHero() {
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [done, setDone] = useState(false);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced.current) {
      setLineIndex(SCRIPT.length);
      setDone(true);
    }
  }, []);

  useEffect(() => {
    if (done || reduced.current) return;

    const current = SCRIPT[lineIndex];
    if (!current) {
      setDone(true);
      return;
    }

    // Prompt lines type character by character; output lines land whole,
    // the way a real shell behaves.
    if (!current.prompt) {
      const timer = setTimeout(() => {
        setLineIndex((i) => i + 1);
        setCharIndex(0);
      }, LINE_PAUSE);
      return () => clearTimeout(timer);
    }

    if (charIndex < current.text.length) {
      const timer = setTimeout(() => setCharIndex((c) => c + 1), TYPE_MS);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      setLineIndex((i) => i + 1);
      setCharIndex(0);
    }, LINE_PAUSE * 1.6);
    return () => clearTimeout(timer);
  }, [lineIndex, charIndex, done]);

  return (
    <section className="relative overflow-hidden px-5 pt-20 pb-16 sm:pt-28">
      <div aria-hidden className="hairline-grid pointer-events-none absolute inset-0 opacity-50" />

      <div className="relative mx-auto max-w-3xl">
        <p className="font-data text-[11px] tracking-[0.3em] text-amber">
          A PERSONAL DISCIPLINE OPERATING SYSTEM
        </p>

        <h1 className="font-data mt-5 text-4xl leading-[1.05] tracking-tight sm:text-6xl">
          <span className="text-amber">~/</span>consistency
        </h1>

        <p className="mt-5 max-w-lg text-base text-ink-soft sm:text-lg">
          You already know what to do. The problem is doing it every day. This makes skipping
          visible and progress measurable — with a rank you can actually lose.
        </p>

        <div
          className="card mt-9 overflow-hidden p-0"
          role="img"
          aria-label="Terminal showing a sample day: 8 of 8 core tasks, 27 day streak, Expert rank"
        >
          <div className="flex items-center gap-1.5 border-b border-line px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
            <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
            <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
            <span className="font-data ml-2 text-[10px] tracking-widest text-faint">
              ~/consistency
            </span>
          </div>

          <div className="font-data min-h-[268px] space-y-1.5 p-4 text-xs leading-relaxed sm:text-sm">
            {SCRIPT.slice(0, lineIndex + 1).map((line, i) => {
              const isCurrent = i === lineIndex;
              const text = isCurrent && line.prompt ? line.text.slice(0, charIndex) : line.text;
              return (
                <p
                  key={i}
                  className={
                    line.tone === "ok"
                      ? "text-good"
                      : line.tone === "amber"
                        ? "text-amber"
                        : line.tone === "dim"
                          ? "text-faint"
                          : "text-ink-soft"
                  }
                >
                  {line.prompt ? <span className="text-amber">$ </span> : <span className="pl-3" />}
                  {text}
                  {isCurrent && line.prompt && !done ? (
                    <span className="ml-0.5 inline-block h-3.5 w-2 translate-y-0.5 bg-amber" />
                  ) : null}
                </p>
              );
            })}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/register"
            className="font-data rounded-md bg-amber px-5 py-2.5 text-sm text-void transition-colors hover:bg-amber-soft"
          >
            Start tracking
          </Link>
          <Link
            href="/login"
            className="font-data rounded-md border border-line bg-raised px-5 py-2.5 text-sm text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
          >
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}
