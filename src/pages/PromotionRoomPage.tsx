import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import MainHeader from "@/components/layout/MainHeader";
import AuthStatus from "@/features/auth/AuthStatus";
import { useAuth } from "@/context/AuthContext";
import { promotionService } from "@/services/promotionService";
import { walletService } from "@/services/walletService";
import type { AuctionSnapshot, PromotionCampaign, PromotionResourceType, RankingItem } from "@/types/promotion";
import styles from "./PromotionRoomPage.module.css";

const RESOURCES: { value: PromotionResourceType; label: string }[] = [
  { value: "feed_top_slot", label: "首页置顶" },
  { value: "search_top_slot", label: "搜索置顶" }
];

const POLL_INTERVAL_MS = 4000;

const PromotionRoomPage = () => {
  const { postId = "" } = useParams<{ postId: string }>();
  const { tokens, user } = useAuth();
  const navigate = useNavigate();
  const accessToken = tokens?.accessToken ?? null;

  // createCampaign 表单 state
  const [resourceType, setResourceType] = useState<PromotionResourceType>("feed_top_slot");
  // 刷新恢复：从 sessionStorage 读 campaign + auctionWindowId
  const [campaign, setCampaign] = useState<PromotionCampaign | null>(() => {
    try {
      const saved = sessionStorage.getItem(`promo:${postId}`);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [auctionWindowId, setAuctionWindowId] = useState<string | null>(() => {
    return sessionStorage.getItem(`promo:window:${postId}`);
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // 竞价视图 state
  const [snapshot, setSnapshot] = useState<AuctionSnapshot | null>(null);
  const [polling, setPolling] = useState(false);
  const [bidAmount, setBidAmount] = useState("");
  const [bidding, setBidding] = useState(false);
  const [bidError, setBidError] = useState<string | null>(null);
  const [bidPending, setBidPending] = useState(false);  // 出价后等待排名更新
  const [balance, setBalance] = useState<number | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const bidPendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapshotRef = useRef<AuctionSnapshot | null>(null);  // B1: ref 持有最新 snapshot，避免闭包陈旧

  // 拉积分余额
  const refreshBalance = useCallback(async () => {
    if (!accessToken) return;
    try {
      const resp = await walletService.balance(accessToken);
      if (mountedRef.current) setBalance(resp.availableBalance);
    } catch { /* 静默 */ }
  }, [accessToken]);

  useEffect(() => {
    mountedRef.current = true;
    refreshBalance();
    // 刷新恢复：有 campaign + auctionWindowId 时自动恢复轮询
    if (campaign && auctionWindowId && accessToken) {
      void pollSnapshot(auctionWindowId);
      startPolling(auctionWindowId);
    }
    return () => {
      mountedRef.current = false;
      if (pollTimerRef.current !== null) clearTimeout(pollTimerRef.current);
      if (bidPendingTimerRef.current !== null) clearTimeout(bidPendingTimerRef.current);
    };
  }, [refreshBalance]); // eslint-disable-line react-hooks/exhaustive-deps

  // createCampaign：startAt 锁定 now，endAt 默认 now+24h
  const handleCreate = async () => {
    if (!accessToken || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const now = new Date();
      const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const resp = await promotionService.createCampaign({
        postId,
        resourceType,
        startAt: now.toISOString(),
        endAt: end.toISOString()
      }, accessToken);
      if (mountedRef.current) {
        setCampaign(resp);
        sessionStorage.setItem(`promo:${postId}`, JSON.stringify(resp));
      }
    } catch (e) {
      if (mountedRef.current) setCreateError(e instanceof Error ? e.message : "创建失败");
    } finally {
      if (mountedRef.current) setCreating(false);
    }
  };

  // snapshot 轮询
  const pollSnapshot = useCallback(async (windowId: string) => {
    if (!accessToken) return;
    setPolling(true);
    try {
      const snap = await promotionService.snapshot(windowId, accessToken);
      if (mountedRef.current) {
        setSnapshot(snap);
        snapshotRef.current = snap;  // B1: 同步 ref 供 startPolling 闭包读取
        // 出价 pending：排名含我的出价 → 清 pending
        if (bidPending && snap.ranking.some(r => String(user?.id) === r.bidderUserId)) {
          setBidPending(false);
          if (bidPendingTimerRef.current !== null) {
            clearTimeout(bidPendingTimerRef.current);
            bidPendingTimerRef.current = null;
          }
          refreshBalance();
        }
      }
    } catch { /* 静默，下次轮询重试 */ }
    finally { if (mountedRef.current) setPolling(false); }
  }, [accessToken, bidPending, user?.id, refreshBalance]);

  // campaign 创建后开始轮询（用 submitBid 返回的 auctionWindowId，或先出价拿 windowId）
  // 实际上 createCampaign 不返回 windowId——需先出价拿 windowId 才能轮询
  // 这里：campaign 创建后，等用户首次出价拿 auctionWindowId，再开始轮询

  // 出价
  const handleBid = async () => {
    if (!accessToken || !campaign || bidding) return;
    const amount = Number(bidAmount);
    if (!amount || amount <= 0) { setBidError("请输入有效金额"); return; }
    if (balance !== null && amount > balance) { setBidError("积分不足"); return; }
    setBidding(true);
    setBidError(null);
    try {
      const resp = await promotionService.submitBid(campaign.id, {
        bidAmount: amount,
        idempotencyKey: crypto.randomUUID()
      }, accessToken);
      // submitBid 200 即结束出价 loading
      if (mountedRef.current) {
        setBidding(false);
        setBidPending(true);
        setBidAmount("");  // 清空出价输入
      }
      // 出价成功后延迟刷新积分余额（hold 是 bprime 异步链路 1-3s 后才冻结）
      setTimeout(() => { void refreshBalance(); }, 3000);
      // 立即触发轮询（用返回的 auctionWindowId）
      setAuctionWindowId(resp.auctionWindowId);
      sessionStorage.setItem(`promo:window:${postId}`, resp.auctionWindowId);
      void pollSnapshot(resp.auctionWindowId);
      // 启动 4s 轮询
      startPolling(resp.auctionWindowId);
      // I3: 8s 后排名仍无我的出价 → 显示最终态"处理中（可能延迟）"并允许重试
      if (bidPendingTimerRef.current !== null) clearTimeout(bidPendingTimerRef.current);
      bidPendingTimerRef.current = setTimeout(() => {
        if (mountedRef.current && bidPending) {
          setBidPending(false);
          setBidError("出价处理中（可能延迟），请稍后查看排名");
        }
      }, 8000);
    } catch (e) {
      if (mountedRef.current) {
        setBidError(e instanceof Error ? e.message : "出价失败");
        setBidding(false);
      }
    }
  };

  const startPolling = (windowId: string) => {
    if (pollTimerRef.current !== null) clearTimeout(pollTimerRef.current);
    const tick = () => {
      void pollSnapshot(windowId).then(() => {
        // B1: 用 snapshotRef 读最新状态。首次轮询 snapshotRef 可能还是 null（async 未返回），
        // 默认续轮询；pollSnapshot 返回后 snapshotRef 有值，SETTLED 时停。
        if (!mountedRef.current) return;
        if (snapshotRef.current?.status === "SETTLED") return;  // 窗口结算停
        pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS);
      });
    };
    pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS);
  };

  if (!accessToken) {
    return (
      <AppLayout header={<MainHeader headline="推广" rightSlot={<AuthStatus />} />}>
        <div className={styles.empty}>请先登录</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout header={<MainHeader headline="推广竞价" rightSlot={<AuthStatus />} />}>
      {/* 积分余额 */}
      <div className={styles.balanceRow}>
        积分：<span className={styles.balanceNum}>{balance ?? "—"}</span>
      </div>

      {!campaign ? (
        /* createCampaign 表单 */
        <div className={styles.formCard}>
          <h2 className={styles.formTitle}>创建推广活动</h2>
          <div className={styles.field}>
            <label className={styles.label}>资源位</label>
            <div className={styles.resourceGrid}>
              {RESOURCES.map(r => (
                <button
                  key={r.value}
                  type="button"
                  className={`${styles.resourceBtn} ${resourceType === r.value ? styles.resourceActive : ""}`}
                  onClick={() => setResourceType(r.value)}
                  disabled={creating}
                >{r.label}</button>
              ))}
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>时间段</label>
            <div className={styles.timeRange}>现在 ~ 24 小时内（自动覆盖竞价窗口）</div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>推广帖子</label>
            <div className={styles.postId}>帖子 ID: {postId}</div>
          </div>
          {createError ? <div className={styles.error}>{createError}</div> : null}
          <button type="button" className={styles.submitBtn} onClick={() => void handleCreate()} disabled={creating}>
            {creating ? "创建中…" : "创建活动并进入竞价"}
          </button>
        </div>
      ) : (
        /* 竞价视图 */
        <div className={styles.roomCard}>
          <div className={styles.roomHeader}>
            <h2 className={styles.roomTitle}>竞价房间</h2>
            <div className={styles.windowInfo}>
              {snapshot?.status === "OPEN" && snapshot?.windowEndAt ? (
                <span className={styles.windowCountdown}>
                  剩余 {Math.max(0, Math.ceil((new Date(snapshot.windowEndAt).getTime() - Date.now()) / 60000))} 分钟
                </span>
              ) : null}
              <span className={styles.windowStatus}>{snapshot?.status === "OPEN" ? "竞价中" : snapshot?.status === "SETTLED" ? "已结算" : (snapshot?.status ?? "等待出价")}</span>
            </div>
          </div>

          {/* 排名 */}
          <div className={styles.rankingSection}>
            <h3 className={styles.sectionTitle}>当前排名</h3>
            {snapshot && snapshot.ranking.length > 0 ? (
              <div className={styles.rankingList}>
                {snapshot.ranking.map((r: RankingItem) => {
                  const isMe = String(user?.id) === r.bidderUserId;
                  return (
                    <div key={r.campaignId} className={`${styles.rankItem} ${isMe ? styles.rankMine : ""}`}>
                      <span className={styles.rankNum}>第 {r.rank} 名</span>
                      <span className={styles.rankBid}>{r.bidAmount} 积分</span>
                      {isMe ? <span className={styles.rankMe}>我</span> : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={styles.empty}>{polling ? "加载中…" : "暂无排名，出价抢占首位"}</div>
            )}
            {bidPending ? <div className={styles.pending}>出价处理中…</div> : null}
          </div>

          {/* 出价表单 */}
          <div className={styles.bidSection}>
            <h3 className={styles.sectionTitle}>出价</h3>
            <div className={styles.bidRow}>
              <input
                type="number"
                className={styles.bidInput}
                value={bidAmount}
                onChange={e => setBidAmount(e.target.value)}
                placeholder="出价积分"
                disabled={bidding}
                min={1}
                max={balance ?? undefined}
              />
              <button type="button" className={styles.bidBtn} onClick={() => void handleBid()} disabled={bidding || !bidAmount}>
                {bidding ? "出价中…" : "出价"}
              </button>
            </div>
            {bidError ? <div className={styles.error}>{bidError}</div> : null}
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default PromotionRoomPage;
