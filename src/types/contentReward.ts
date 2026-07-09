// 内容创作奖励配置（后端 GET /api/v1/content-reward/config 返回）
export type ContentRewardConfig = {
  enabled: boolean;
  postAmount: number;
  commentAmount: number;
};
