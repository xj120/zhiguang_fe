import { apiFetch } from "./apiClient";
import type { ModerationReportRequest, ModerationReportResponse } from "@/types/moderation";

const MODERATION_PREFIX = "/api/v1/moderation";

export const moderationService = {
  // 提交举报（POST /moderation/reports → 202 ACCEPTED）
  report: (payload: ModerationReportRequest, accessToken: string) =>
    apiFetch<ModerationReportResponse>(`${MODERATION_PREFIX}/reports`, {
      method: "POST",
      body: payload,
      accessToken
    })
};
