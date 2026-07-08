// 推广资源位（后端 PromotionResourceType.placement()）
export type PromotionResourceType = "feed_top_slot" | "search_top_slot";

// 推广活动
export type PromotionCampaign = {
  id: string;
  postId: string;
  resourceType: PromotionResourceType;
  status: string;
  startAt: string;
  endAt: string;
};

export type CreateCampaignRequest = {
  postId: string;
  resourceType: PromotionResourceType;
  startAt: string;  // ISO-8601 Z 串
  endAt: string;
};

// 出价
export type SubmitBidRequest = {
  bidAmount: number;
  idempotencyKey: string;
};

export type SubmitBidResponse = {
  commandId: string;
  auctionWindowId: string;
  status: string;
  resultAvailable: boolean;  // 后端恒 false，前端不依赖
};

// 竞价排名项（id 全 string，snowflake 精度防御；bidAmount 是积分类小额整数保留 number）
export type RankingItem = {
  campaignId: string;
  bidderUserId: string;
  postId: string;
  bidAmount: number;
  rank: number;
};

// 窗口快照（auctionWindowId string；decisionVersion 单调递增计数保留 number）
export type AuctionSnapshot = {
  auctionWindowId: string;
  status: string;
  ranking: RankingItem[];
  serverTime: string;
  decisionVersion: number;
  windowEndAt?: string;
};

// 钱包余额（对齐后端 4 字段，前端文案显示"积分"）
export type WalletBalance = {
  availableBalance: number;
  heldBalance: number;
  escrowedBalance: number;
  status: string;
};
