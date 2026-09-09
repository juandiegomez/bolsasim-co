import type { Clock } from "@/application/ports/clock";

export function createSystemClock(): Clock {
  return {
    now: () => new Date(),
  };
}
