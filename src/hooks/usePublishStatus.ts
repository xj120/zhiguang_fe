import { useCallback, useEffect, useRef, useState } from "react";
import { knowpostService } from "@/services/knowpostService";

// 发布前端编排状态（与后端 attemptStatus 区分）
export type PublishPhase = "idle" | "publishing" | "succeeded" | "failed" | "timeout";

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_TIMES = 30; // 60s 上限（2s × 30）

/**
 * 发布状态轮询 hook。
 *
 * 后端发布是异步的：publish/retryPublish 返回 publishAttemptId 后，post 走 publishing→succeeded/failed。
 * 本 hook 拿到 attemptId 后每 2s 轮询 publishStatus，最多 30 次（60s），超时显示 timeout 出口。
 * attemptId 全程不变（retry 复用同一 id 原地重启，后端 retry_count+1、failedStep 清空）。
 *
 * cleanup：unmount / reset / 新轮询启动前都清 interval，防泄漏与双轮询。
 */
export const usePublishStatus = (accessToken: string | null | undefined) => {
  const [phase, setPhase] = useState<PublishPhase>("idle");
  const [failedStep, setFailedStep] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(false);

  const attemptIdRef = useRef<string | null>(null);
  const postIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCountRef = useRef(0);
  const mountedRef = useRef(true);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // 单次轮询：拉 status，按四态分流
  const pollOnce = useCallback(async () => {
    const postId = postIdRef.current;
    const attemptId = attemptIdRef.current;
    if (!postId || !attemptId || !accessToken) return;

    try {
      const resp = await knowpostService.publishStatus(postId, attemptId, accessToken);
      if (!mountedRef.current) return;

      if (resp.attemptStatus === "publishing") {
        pollCountRef.current += 1;
        if (pollCountRef.current >= POLL_MAX_TIMES) {
          setPhase("timeout");
          return; // 停轮询
        }
        timerRef.current = setTimeout(() => { void pollOnce(); }, POLL_INTERVAL_MS);
        return;
      }
      if (resp.attemptStatus === "succeeded") {
        setPhase("succeeded");
        setFailedStep(null);
        return;
      }
      // failed
      setPhase("failed");
      setFailedStep(resp.failedStep);
      setRetryable(resp.retryable);
    } catch {
      // 网络抖动等：不立即判失败，按一次轮询计继续（达到上限则 timeout）
      if (!mountedRef.current) return;
      pollCountRef.current += 1;
      if (pollCountRef.current >= POLL_MAX_TIMES) {
        setPhase("timeout");
        return;
      }
      timerRef.current = setTimeout(() => { void pollOnce(); }, POLL_INTERVAL_MS);
    }
  }, [accessToken]);

  // 启动一轮轮询（清旧 timer 防双轮询）
  const startPolling = useCallback((attemptId: string) => {
    clearTimer();
    attemptIdRef.current = attemptId;
    pollCountRef.current = 0;
    setPhase("publishing");
    setFailedStep(null);
    setRetryable(false);
    timerRef.current = setTimeout(() => { void pollOnce(); }, POLL_INTERVAL_MS);
  }, [pollOnce]);

  // publish + 轮询
  const start = useCallback(async (postId: string) => {
    if (!accessToken) return;
    clearTimer();
    postIdRef.current = postId;
    setPhase("publishing");
    try {
      const resp = await knowpostService.publish(postId, crypto.randomUUID(), accessToken);
      if (!mountedRef.current) return;
      startPolling(resp.publishAttemptId);
    } catch (e) {
      // publish 失败：复位 phase，否则按钮锁死在 publishing（CreatePage catch 显示错误）
      if (mountedRef.current) setPhase("idle");
      throw e;
    }
  }, [accessToken, startPolling]);

  // retry（同一 attemptId 原地回 publishing）+ 重新轮询
  const retry = useCallback(async () => {
    const postId = postIdRef.current;
    const attemptId = attemptIdRef.current;
    if (!postId || !attemptId || !accessToken) return;
    clearTimer();
    setPhase("publishing");
    setFailedStep(null);
    setRetryable(false);
    try {
      const resp = await knowpostService.retryPublish(postId, attemptId, accessToken);
      if (!mountedRef.current) return;
      // retry 复用同一 attemptId（后端 UPDATE 原地重启），用入参而非返回值更表意
      startPolling(attemptId);
    } catch (e) {
      if (mountedRef.current) setPhase("failed");
      throw e;
    }
  }, [accessToken, startPolling]);

  const reset = useCallback(() => {
    clearTimer();
    attemptIdRef.current = null;
    postIdRef.current = null;
    pollCountRef.current = 0;
    setPhase("idle");
    setFailedStep(null);
    setRetryable(false);
  }, []);

  // unmount 清理
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimer();
    };
  }, []);

  return { phase, failedStep, retryable, start, retry, reset };
};
