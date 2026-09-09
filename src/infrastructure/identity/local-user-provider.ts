import type { CurrentUserProvider } from "@/application/ports/current-user";
import type { UserId } from "@/domain/ids";

// Domain § User: fixed local identity behind CurrentUserProvider; the MVP has
// no authentication (ADR-0006).
export function createLocalUserProvider(userId: UserId): CurrentUserProvider {
  return {
    currentUserId: () => userId,
  };
}
