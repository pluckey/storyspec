// Time and IDs come through a port so tests are deterministic.
export interface Clock {
  now(): Date
  id(): string
}
