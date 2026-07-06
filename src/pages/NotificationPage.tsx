import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import MainHeader from "@/components/layout/MainHeader";
import AuthStatus from "@/features/auth/AuthStatus";
import { useAuth } from "@/context/AuthContext";
import { notificationService } from "@/services/notificationService";
import type { NotificationItem, NotificationType } from "@/types/notification";
import styles from "./NotificationPage.module.css";

// 文案映射（D1 不显示 actor，按 type+entityType）
const notificationText = (item: NotificationItem): string => {
  const prefix = item.aggregateCount > 1 ? `${item.aggregateCount} 人` : "";
  if (item.type === "like") {
    return item.entityType === "comment" ? `${prefix}赞了你的评论` : `${prefix}赞了你的文章`;
  }
  if (item.type === "comment") return `${prefix}评论了你的文章`;
  if (item.type === "follow") return "关注了你";
  if (item.type === "moderation_action") return "你的内容收到审核处理";
  if (item.type === "report_processed") return "你的举报已处理";
  return "收到一条通知";
};

// 跳转映射（基于 type+entityType，与标记已读解耦）
const notificationTarget = (item: NotificationItem): string | null => {
  if (item.type === "like" && item.entityType === "knowpost" && item.entityId) {
    return `/post/${item.entityId}`;
  }
  if (item.type === "comment" && item.entityId) {
    return `/post/${item.entityId}`;
  }
  if (item.type === "follow") return "/profile";
  // like+comment / moderation_action / report_processed / 未知 → 不跳
  return null;
};

const NotificationPage = () => {
  const { tokens } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const nextCursorCreatedAtRef = useRef<string | null>(null);
  const nextCursorIdRef = useRef<string | null>(null);

  const loadFirst = useCallback(async () => {
    if (!tokens?.accessToken) {
      setError("请先登录查看通知");
      setItems([]);
      return;
    }
    // 清 ref + hasMore，防切账号时 loadMore 读到旧 cursor 污染新账号列表
    nextCursorCreatedAtRef.current = null;
    nextCursorIdRef.current = null;
    setHasMore(false);
    setLoading(true);
    setError(null);
    try {
      const resp = await notificationService.list(null, null, 20, tokens.accessToken);
      setItems(resp.items ?? []);
      nextCursorCreatedAtRef.current = resp.nextCursorCreatedAt ?? null;
      nextCursorIdRef.current = resp.nextCursorId ?? null;
      setHasMore(!!resp.hasMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [tokens?.accessToken]);

  useEffect(() => {
    void loadFirst();
  }, [loadFirst]);

  const loadMore = async () => {
    if (loading || !hasMore || !tokens?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await notificationService.list(
        nextCursorCreatedAtRef.current,
        nextCursorIdRef.current,
        20,
        tokens.accessToken
      );
      setItems(prev => [...prev, ...(resp.items ?? [])]);
      nextCursorCreatedAtRef.current = resp.nextCursorCreatedAt ?? null;
      nextCursorIdRef.current = resp.nextCursorId ?? null;
      setHasMore(!!resp.hasMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  // 点单条：markRead 成功后标记已读 + 徽章回调（无论是否跳转）；跳转看映射；失败不跳+显示错误
  const handleClick = async (item: NotificationItem) => {
    if (!tokens?.accessToken) return;
    if (!item.isRead) {
      try {
        await notificationService.markRead(item.id, tokens.accessToken);
        // 标记成功：本地 isRead=true（徽章 -1 由 Sidebar 自己监听 items 变化或重拉，这里触发 window 事件）
        setItems(prev => prev.map(n => (n.id === item.id ? { ...n, isRead: true } : n)));
        window.dispatchEvent(new CustomEvent("notification-read", { detail: { count: 1 } }));
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "标记失败");
        return; // 失败不跳转，通知保持未读
      }
    }
    const target = notificationTarget(item);
    if (target) navigate(target);
  };

  const handleMarkAllRead = async () => {
    if (!tokens?.accessToken || loading) return;
    setLoading(true);
    setActionError(null);
    try {
      await notificationService.markAllRead(tokens.accessToken);
      setItems(prev => prev.map(n => ({ ...n, isRead: true })));
      window.dispatchEvent(new CustomEvent("notification-read-all"));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setLoading(false);
    }
  };

  const hasUnread = items.some(n => !n.isRead);

  return (
    <AppLayout
      header={
        <MainHeader
          headline="通知"
          rightSlot={<AuthStatus />}
        />
      }
    >
      <div className={styles.toolbar}>
        <span className={styles.title}>通知</span>
        {hasUnread ? (
          <button type="button" className={styles.markAllBtn} onClick={handleMarkAllRead} disabled={loading}>
            {loading ? "处理中…" : "全部已读"}
          </button>
        ) : null}
      </div>
      {error ? <div className={styles.error}>{error}</div> : null}
      {actionError ? <div className={styles.error}>{actionError}</div> : null}
      <div className={styles.list}>
        {items.map(item => (
          <button
            type="button"
            key={item.id}
            className={`${styles.item} ${item.isRead ? styles.read : styles.unread}`}
            onClick={() => void handleClick(item)}
          >
            <span className={styles.dot}>{item.isRead ? "" : "●"}</span>
            <span className={styles.text}>{notificationText(item)}</span>
            <span className={styles.time}>{item.createdAt?.replace("T", " ").slice(0, 16) ?? ""}</span>
          </button>
        ))}
        {loading ? <div className={styles.loading}>加载中…</div> : null}
        {!loading && items.length === 0 && !error ? (
          <div className={styles.empty}>暂无通知</div>
        ) : null}
      </div>
      {hasMore && !loading ? (
        <div className={styles.moreWrap}>
          <button type="button" className={styles.moreBtn} onClick={loadMore}>加载更多</button>
        </div>
      ) : null}
    </AppLayout>
  );
};

export default NotificationPage;
