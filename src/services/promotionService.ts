import { apiFetch } from "./apiClient";
import type {
  PromotionCampaign,
  CreateCampaignRequest,
  SubmitBidRequest,
  SubmitBidResponse,
  AuctionSnapshot,
  PromotionResourceType
} from "@/types/promotion";

const PROMOTION_PREFIX = "/api/v1/promotions";

export const promotionService = {
  // 创建推广活动
  createCampaign: (payload: CreateCampaignRequest, accessToken: string) =>
    apiFetch<PromotionCampaign>(`${PROMOTION_PREFIX}/campaigns`, {
      method: "POST",
      body: payload,
      accessToken
    }),

  // 查询活动
  getCampaign: (campaignId: string, accessToken: string) =>
    apiFetch<PromotionCampaign>(`${PROMOTION_PREFIX}/campaigns/${campaignId}`, {
      accessToken
    }),

  // 提交出价（返回 commandId + auctionWindowId + status + resultAvailable）
  submitBid: (campaignId: string, payload: SubmitBidRequest, accessToken: string) =>
    apiFetch<SubmitBidResponse>(`${PROMOTION_PREFIX}/campaigns/${campaignId}/bids`, {
      method: "POST",
      body: payload,
      accessToken
    }),

  // 查窗口排名快照
  snapshot: (auctionWindowId: string, accessToken: string) =>
    apiFetch<AuctionSnapshot>(`${PROMOTION_PREFIX}/windows/${auctionWindowId}/snapshot`, {
      accessToken
    }),

  // 查当前有效位分配
  activeAllocations: (resourceType: PromotionResourceType, accessToken: string) =>
    apiFetch<unknown[]>(`${PROMOTION_PREFIX}/allocations/active?resourceType=${resourceType}`, {
      accessToken
    })
};
