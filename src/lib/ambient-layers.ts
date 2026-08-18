/** Shared between the client mixer and the server route that lists files. */

export type LayerId =
  | "rain"
  | "thunder"
  | "waves"
  | "wind"
  | "fire"
  | "crickets"
  | "birds"
  | "people";

export const LAYERS: { id: LayerId; label: string }[] = [
  { id: "rain", label: "Rain" },
  { id: "thunder", label: "Thunder" },
  { id: "waves", label: "Waves" },
  { id: "wind", label: "Wind" },
  { id: "fire", label: "Fire" },
  { id: "crickets", label: "Crickets" },
  { id: "birds", label: "Birds" },
  { id: "people", label: "Café" },
];
