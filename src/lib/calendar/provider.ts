import type { DayKey } from "@/lib/time";

/**
 * THE INTEGRATION BOUNDARY (PRD §53).
 *
 * The rule this file exists to enforce: the app never pretends to be synced.
 * Everything internal goes through `ScheduleBlock` rows the user created. An
 * external provider must implement this interface, and until one is actually
 * registered and authorised, `listProviders()` reports it as unavailable and
 * the UI says so plainly.
 *
 * Deliberately absent, because building them without real OAuth would mean
 * faking them: token storage, refresh handling, a sync loop, webhook receivers.
 *
 * Also deliberate: importing is one-directional. An external event may become a
 * read-only `ScheduleBlock` with `source: IMPORTED`. Nothing outside this
 * boundary may create, modify or delete a user's tasks or logs from calendar
 * data without an explicit user action.
 */

export type ExternalEvent = {
  externalId: string;
  title: string;
  /** Local-midnight offsets in minutes, already converted to the user's zone. */
  startMinute: number;
  endMinute: number;
  date: DayKey;
};

export type CalendarProvider = {
  id: string;
  label: string;
  /** True only when credentials exist and the provider can actually be called. */
  isConfigured: () => boolean;
  listEvents: (params: {
    userId: string;
    from: DayKey;
    to: DayKey;
    timezone: string;
  }) => Promise<ExternalEvent[]>;
};

/**
 * Registry. Empty on purpose — adding Google Calendar means implementing the
 * interface above and pushing it here, and nothing else in the app changes.
 */
const PROVIDERS: CalendarProvider[] = [];

export function listProviders() {
  return PROVIDERS.map((provider) => ({
    id: provider.id,
    label: provider.label,
    available: provider.isConfigured(),
  }));
}

export function getProvider(id: string): CalendarProvider | null {
  return PROVIDERS.find((provider) => provider.id === id) ?? null;
}

export class ProviderNotConnectedError extends Error {
  constructor(providerId: string) {
    super(`Calendar provider "${providerId}" is not connected.`);
    this.name = "ProviderNotConnectedError";
  }
}

/**
 * The one function an external provider would flow through. It throws rather
 * than returning an empty list, so a missing integration can never be mistaken
 * for "your calendar is empty today".
 */
export async function fetchExternalEvents(params: {
  providerId: string;
  userId: string;
  from: DayKey;
  to: DayKey;
  timezone: string;
}): Promise<ExternalEvent[]> {
  const provider = getProvider(params.providerId);
  if (!provider || !provider.isConfigured()) {
    throw new ProviderNotConnectedError(params.providerId);
  }

  return provider.listEvents({
    userId: params.userId,
    from: params.from,
    to: params.to,
    timezone: params.timezone,
  });
}
