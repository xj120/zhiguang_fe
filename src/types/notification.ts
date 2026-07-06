// 通知类型
export type NotificationType =
  | "like"
  | "comment"
  | "follow"
  | "moderation_action"
  | "report_processed";

// 通知列表项（id/actorUserId/entityId/secondEntityId 全 string，snowflake 精度防御）
export type NotificationItem = {
  id: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
  actorUserId: string;
  entityType: string | null;
  entityId: string | null;
  secondEntityType: string | null;
  secondEntityId: string | null;
  aggregateCount: number;
  // 对齐后端契约，当前不渲染（后续做"5 分钟内 N 人赞"再取）
  windowStart: string | null;
  windowEnd: string | null;
};

// 通知列表分页响应（双游标：cursorCreatedAt + cursorId 成对回传）
export type NotificationPage = {
  items: NotificationItem[];
  nextCursorCreatedAt: string | null;
  nextCursorId: string | null;
  hasMore: boolean;
};

// 未读数响应
export type NotificationUnreadCount = {
  unreadCount: number;
};
