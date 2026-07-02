import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { commentService } from "@/services/commentService";
import type { CommentItem } from "@/types/comment";
import { ApiError } from "@/services/apiClient";
import styles from "./CommentSection.module.css";

type OptimisticItem = CommentItem & { __optimistic?: true };

const toOptimistic = (pendingCommentId: number, creatorId: number, body: string): OptimisticItem => ({
  commentId: pendingCommentId,
  postId: 0,
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
  __optimistic: true
});

const CommentSection = ({ postId }: { postId: string }) => {
  const { tokens, user } = useAuth();
  const accessToken = tokens?.accessToken;

  const [items, setItems] = useState<OptimisticItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef<{ createTime: string | null; commentId: number | null }>({
    createTime: null,
    commentId: null
  });
  // 同步守卫：防止 loadMore 双击竞态（state 守卫在 React 批处理前不生效）
  const loadingRef = useRef(false);
  // 卸载守卫：异步请求 resolve 时组件可能已卸载
  const mountedRef = useRef(true);

  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
      setItems(prev => [toOptimistic(resp.pendingCommentId, user?.id ?? 0, body), ...prev]);
      setInput("");
    } catch (e) {
      if (!mountedRef.current) return;
      setSubmitError(e instanceof ApiError ? e.message : "发送失败");
    } finally {
      if (mountedRef.current) setSubmitting(false);
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
