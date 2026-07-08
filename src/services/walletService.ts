import { apiFetch } from "./apiClient";
import type { WalletBalance } from "@/types/promotion";

const WALLET_PREFIX = "/api/v1/wallet";

export const walletService = {
  // 查询余额（前端文案显示"积分"）
  balance: (accessToken: string) =>
    apiFetch<WalletBalance>(`${WALLET_PREFIX}/me`, {
      accessToken
    })
};
