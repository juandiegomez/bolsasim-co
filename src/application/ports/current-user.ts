import type { UserId } from "@/domain/ids";

export interface CurrentUserProvider {
  currentUserId(): UserId;
}
