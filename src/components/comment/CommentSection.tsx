import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { commentService } from "@/services/commentService";
import { contentRewardService } from "@/services/contentRewardService";
import type { CommentItem } from "@/types/comment";
import type { ContentRewardConfig } from "@/types/contentReward";
import { ApiError } from "@/services/apiClient";
import styles from "./CommentSection.module.css";

type OptimisticItem = CommentItem & { __optimistic?: true };

const toOptimistic = (pendingCommentId: string, creatorId: string, body: string): OptimisticItem => ({
  commentId: pendingCommentId,
  postId: "0",
  rootId: null,
  parentId: null,
  creatorId,
  body,
  status: 0,
  deleted: false,
  likeCount: 0,
  replyCount: 0,
  createTime: new Date().toISOString(),
  updateTime: new Date().toISOString(),
  liked: false,
  __optimistic: true
});

const CommentSection = ({ postId }: { postId: string }) => {
  const { tokens, user } = useAuth();
  const accessToken = tokens?.accessToken;

  const [items, setItems] = useState<OptimisticItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef<{ createTime: string | null; commentId: string | null }>({
    createTime: null,
    commentId: null
  });
  // 同步守卫：防止 loadMore 双击竞态（state 守卫在 React 批处理前不生效）
  const loadingRef = useRef(false);
  // 卸载守卫：异步请求 resolve 时组件可能已卸载
  const mountedRef = useRef(true);
  // 点赞操作同步守卫（防止同一评论连点竞态）
  const likingRef = useRef<Set<string>>(new Set());
  // 删除操作同步守卫
  const deletingRef = useRef<Set<string>>(new Set());
  // 操作中 commentId（驱动按钮 disabled 渲染；ref 不触发 re-render 故另存 state）
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [rewardConfig, setRewardConfig] = useState<ContentRewardConfig | null>(null);
  const [rewardHint, setRewardHint] = useState<string | null>(null);
  const rewardHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 拉取奖励配置（带缓存），评论提交后按 config.commentAmount 显示 "+N 积分"
  useEffect(() => {
    if (!accessToken) return;
    contentRewardService.config(accessToken).then(setRewardConfig).catch(() => { /* 静默 */ });
  }, [accessToken]);

  useEffect(() => () => {
    if (rewardHintTimerRef.current !== null) clearTimeout(rewardHintTimerRef.current);
  }, []);

  const loadFirst = useCallback(async (signal?: { cancelled: boolean }) => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const page = await commentService.list(postId, { limit: 20 }, accessToken);
      if (signal?.cancelled) return;
      setItems(page.items);
      setHasMore(page.hasMore);
      cursorRef.current = {
        createTime: page.nextCursorCreateTime,
        commentId: page.nextCursorCommentId
      };
    } catch (e) {
      if (signal?.cancelled) return;
      setError(e instanceof ApiError ? e.message : "评论加载失败");
    } finally {
      if (!signal?.cancelled) setLoading(false);
    }
  }, [accessToken, postId]);

  const loadMore = useCallback(async () => {
    if (!accessToken || !hasMore || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const page = await commentService.list(
        postId,
        {
          limit: 20,
          cursorCreateTime: cursorRef.current.createTime,
          cursorCommentId: cursorRef.current.commentId
        },
        accessToken
      );
      setItems(prev => [...prev, ...page.items]);
      setHasMore(page.hasMore);
      cursorRef.current = {
        createTime: page.nextCursorCreateTime,
        commentId: page.nextCursorCommentId
      };
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "评论加载失败");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [accessToken, postId, hasMore]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!accessToken) {
      setItems([]);
      setHasMore(false);
      return;
    }
    const signal = { cancelled: false };
    loadFirst(signal);
    return () => { signal.cancelled = true; };
  }, [accessToken, postId, loadFirst]);

  const handleSubmit = async () => {
    const body = input.trim();
    if (!accessToken || !body || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const resp = await commentService.submit(postId, body, accessToken);
      if (!mountedRef.current) return;
      setItems(prev => [toOptimistic(resp.pendingCommentId, String(user?.id ?? 0), body), ...prev]);
      setInput("");
      // 评论提交成功后显示 "+N 积分" 轻提示（1.5s 消失）
      if (rewardConfig?.enabled && rewardConfig.commentAmount > 0) {
        setRewardHint(`+${rewardConfig.commentAmount} 积分`);
        if (rewardHintTimerRef.current !== null) clearTimeout(rewardHintTimerRef.current);
        rewardHintTimerRef.current = setTimeout(() => {
          if (mountedRef.current) setRewardHint(null);
        }, 1500);
      }
    } catch (e) {
      if (!mountedRef.current) return;
      setSubmitError(e instanceof ApiError ? e.message : "发送失败");
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };

  const handleLike = async (commentId: string) => {
    if (!accessToken || likingRef.current.has(commentId)) return;
    const target = items.find(i => i.commentId === commentId);
    if (!target || target.__optimistic || target.deleted) return;
    likingRef.current.add(commentId);
    setLikingIds(prev => new Set(prev).add(commentId));
    const wasLiked = target.liked;
    try {
      const resp = wasLiked
        ? await commentService.unlike(commentId, accessToken)
        : await commentService.like(commentId, accessToken);
      if (!mountedRef.current) return;
      // changed=true 才翻转本地 liked + ±1 计数；changed=false 保持后端初始值
      if (resp.changed) {
        setItems(prev => prev.map(i =>
          i.commentId === commentId
            ? { ...i, liked: !wasLiked, likeCount: Math.max(0, i.likeCount + (wasLiked ? -1 : 1)) }
            : i
        ));
      }
    } catch {
      // 静默失败，不翻转本地态
    } finally {
      likingRef.current.delete(commentId);
      setLikingIds(prev => { const n = new Set(prev); n.delete(commentId); return n; });
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!accessToken || deletingRef.current.has(commentId)) return;
    const target = items.find(i => i.commentId === commentId);
    if (!target || target.__optimistic || target.deleted) return;
    deletingRef.current.add(commentId);
    setDeletingIds(prev => new Set(prev).add(commentId));
    try {
      await commentService.delete(commentId, accessToken);
      if (!mountedRef.current) return;
      // 软删除：本地 body 改 [deleted] + deleted=true，不移除（与后端一致）
      setItems(prev => prev.map(i =>
        i.commentId === commentId
          ? { ...i, deleted: true, body: "[deleted]" }
          : i
      ));
    } catch {
      // 静默忽略（非作者/不存在/网络）
    } finally {
      deletingRef.current.delete(commentId);
      setDeletingIds(prev => { const n = new Set(prev); n.delete(commentId); return n; });
    }
  };

  const retry = () => {
    if (cursorRef.current.createTime || cursorRef.current.commentId) {
      loadMore();
    } else {
      loadFirst();
    }
  };

  if (!accessToken) {
    return (
      <section className={styles.section}>
        <div className={styles.loginHint}>登录后查看评论</div>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <div className={styles.inputBox}>
        <textarea
          className={styles.textarea}
          placeholder="写下你的评论…"
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={submitting}
          rows={2}
        />
        <div className={styles.inputFoot}>
          {submitError ? <span className={styles.error}>{submitError}</span> : null}
          {rewardHint ? <span className={styles.rewardHint}>{rewardHint}</span> : null}
          <button
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={submitting || !input.trim()}
          >
            {submitting ? "发送中…" : "发送"}
          </button>
        </div>
      </div>

      <div className={styles.list}>
        {loading && items.length === 0 ? (
          <div className={styles.hint}>加载中…</div>
        ) : error ? (
          <div className={styles.hint}>
            {error}
            <button className={styles.retryBtn} onClick={retry}>重试</button>
          </div>
        ) : items.length === 0 ? (
          <div className={styles.hint}>暂无评论</div>
        ) : (
          <>
            {items.map(item => (
              <div key={item.commentId} className={styles.item}>
                <div className={styles.itemBody}>
                  {item.__optimistic ? <span className={styles.sending}>发送中 · </span> : null}
                  {item.body}
                </div>
                <div className={styles.itemMeta}>
                  <span>{new Date(item.createTime).toLocaleString("zh-CN")}</span>
                  {!item.__optimistic && !item.deleted ? (
                    <button
                      type="button"
                      className={`${styles.likeBtn} ${item.liked ? styles.liked : ""}`}
                      onClick={() => handleLike(item.commentId)}
                      disabled={likingIds.has(item.commentId)}
                      aria-pressed={item.liked}
                      aria-label={item.liked ? "取消点赞" : "点赞"}
                    >
                      <span>{item.liked ? "♥" : "♡"}</span>
                      <span className={styles.likeCount}>{item.likeCount}</span>
                    </button>
                  ) : null}
                  {!item.__optimistic && !item.deleted && item.creatorId === String(user?.id) ? (
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      onClick={() => handleDelete(item.commentId)}
                      disabled={deletingIds.has(item.commentId)}
                      aria-label="删除评论"
                    >
                      删除
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {hasMore ? (
              <button className={styles.moreBtn} onClick={loadMore} disabled={loading}>
                {loading ? "加载中…" : "加载更多"}
              </button>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
};

export default CommentSection;
