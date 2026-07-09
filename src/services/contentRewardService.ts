import { apiFetch } from "./apiClient";
import type { ContentRewardConfig } from "@/types/contentReward";

const PREFIX = "/api/v1/content-reward";

// 缓存奖励配置（启动后首次拉取，避免发帖/评论时重复请求）
let cachedConfig: ContentRewardConfig | null = null;

export const contentRewardService = {
  // 拉取奖励配置（带缓存）。enabled=false 或金额 0 时前端不显示 "+N 积分"。
  config: async (accessToken: string): Promise<ContentRewardConfig> => {
    if (cachedConfig) return cachedConfig;
    cachedConfig = await apiFetch<ContentRewardConfig>(`${PREFIX}/config`, { accessToken });
    return cachedConfig;
  },

  // 仅供测试 / 登出清缓存用
  resetCache: () => { cachedConfig = null; }
};
