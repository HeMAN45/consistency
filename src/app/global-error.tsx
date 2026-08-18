"use client";

import { useEffect } from "react";

/**
 * Catches failures in the root and app layouts, which bubble past a segment
 * error boundary. The commonest one in practice is the database being
 * unreachable while a serverless Postgres instance wakes up, so that case gets
 * named rather than shown as a stack trace.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const message = error.message ?? "";
  const isDatabase =
    message.includes("Can't reach database server") ||
    message.includes("PrismaClientInitializationError") ||
    message.includes("ECONNREFUSED");

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#08090a",
          color: "#e9edf0",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          padding: "1.25rem",
        }}
      >
        <div style={{ maxWidth: "26rem", textAlign: "center" }}>
          <p
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: "11px",
              letterSpacing: "0.3em",
              color: "#ffb020",
              margin: 0,
            }}
          >
            {isDatabase ? "DATABASE UNREACHABLE" : "SOMETHING BROKE"}
          </p>

          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: "1rem 0 0" }}>
            {isDatabase ? "Waking the database." : "That didn't load."}
          </h1>

          <p style={{ color: "#8a949c", fontSize: "0.875rem", lineHeight: 1.6, marginTop: "0.75rem" }}>
            {isDatabase
              ? "Serverless databases sleep when idle, and the first request after that often times out. Nothing is lost. Try again in a few seconds."
              : "Your logged data is safe. This failed on the way to the page, not on the way to the database."}
          </p>

          {error.digest ? (
            <p
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "11px",
                color: "#565f67",
                marginTop: "0.75rem",
              }}
            >
              REF {error.digest}
            </p>
          ) : null}

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              background: "#ffb020",
              color: "#08090a",
              border: 0,
              borderRadius: "6px",
              padding: "0.6rem 1.25rem",
              fontFamily: "ui-monospace, monospace",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
