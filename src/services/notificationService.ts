import { apiFetch } from "./apiClient";
import type { NotificationPage, NotificationUnreadCount } from "@/types/notification";

const NOTIFICATION_PREFIX = "/api/v1/notifications";

export const notificationService = {
  // 通知列表（双游标成对传：cursorCreatedAt + cursorId 都传或都不传）
  list: (
    cursorCreatedAt: string | null,
    cursorId: string | null,
    limit = 20,
    accessToken: string
  ) => {
    const usp = new URLSearchParams({ limit: String(limit) });
    if (cursorCreatedAt) usp.set("cursorCreatedAt", cursorCreatedAt);
    if (cursorId) usp.set("cursorId", cursorId);
    return apiFetch<NotificationPage>(
      `${NOTIFICATION_PREFIX}?${usp.toString()}`,
      { accessToken }
    );
  },

  // 未读数
  unreadCount: (accessToken: string) =>
    apiFetch<NotificationUnreadCount>(`${NOTIFICATION_PREFIX}/unread-count`, {
      accessToken
    }),

  // 标记单条已读（POST /{id}/read，204）
  markRead: (id: string, accessToken: string) =>
    apiFetch<void>(`${NOTIFICATION_PREFIX}/${id}/read`, {
      method: "POST",
      accessToken
    }),

  // 全部已读（POST /read-all，204）
  markAllRead: (accessToken: string) =>
    apiFetch<void>(`${NOTIFICATION_PREFIX}/read-all`, {
      method: "POST",
      accessToken
    })
};
