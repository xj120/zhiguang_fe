// 举报对象类型（后端只允许 post/comment，本 feature 只用 post）
export type ModerationTargetType = "post" | "comment";

// 举报原因（后端 ModerationReason 枚举）
export type ModerationReason =
  | "spam"
  | "harassment"
  | "violence"
  | "pornography"
  | "illegal"
  | "other";

// 举报请求（targetId 是 snowflake，string 防精度丢失）
export type ModerationReportRequest = {
  targetType: ModerationTargetType;
  targetId: string;
  reason: ModerationReason;
  description?: string; // ≤512 字，空串/纯空格前端传 undefined（后端 blankToNull 存 null）
};

// 举报响应（reportId 是 snowflake，后端 DTO 已 String 化）
export type ModerationReportResponse = {
  reportId: string;
  status: string;
};
