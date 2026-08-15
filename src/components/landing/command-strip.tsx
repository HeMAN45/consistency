"use client";

import { useEffect, useState } from "react";

const COMMANDS = [
  "complete dsa",
  "log steps 10432",
  "focus dsa 90",
  "review week",
  "open sync",
];

/**
 * Identity, not spectacle: a single line that keeps typing the commands the
 * product actually accepts. The `~/` in the name should do real work.
 */
export function CommandStrip() {
  const [index, setIndex] = useState(0);
  const [chars, setChars] = useState(0);
  const [erasing, setErasing] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setChars(COMMANDS[0].length);
      return;
    }

    const current = COMMANDS[index];

    if (!erasing && chars < current.length) {
      const timer = setTimeout(() => setChars((c) => c + 1), 42);
      return () => clearTimeout(timer);
    }
    if (!erasing && chars === current.length) {
      const timer = setTimeout(() => setErasing(true), 1500);
      return () => clearTimeout(timer);
    }
    if (erasing && chars > 0) {
      const timer = setTimeout(() => setChars((c) => c - 1), 18);
      return () => clearTimeout(timer);
    }

    setErasing(false);
    setIndex((i) => (i + 1) % COMMANDS.length);
  }, [chars, erasing, index]);

  return (
    <p className="font-data text-sm text-muted sm:text-base" aria-hidden>
      <span className="text-amber">~/consistency $ </span>
      <span className="text-ink-soft">{COMMANDS[index].slice(0, chars)}</span>
      <span className="ml-0.5 inline-block h-4 w-[7px] translate-y-0.5 bg-amber" />
    </p>
  );
}
