import { useEffect, useRef, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import MainHeader from "@/components/layout/MainHeader";
import CourseCard from "@/components/cards/CourseCard";
import LikeFavBar from "@/components/common/LikeFavBar";
import { knowpostService } from "@/services/knowpostService";
import AuthStatus from "@/features/auth/AuthStatus";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import type { FeedItem } from "@/types/knowpost";
import styles from "./HomePage.module.css";

type FeedEntry = Pick<FeedItem, "id" | "title" | "description" | "coverImage" | "tags" | "tagJson" | "authorAvatar" | "authorAvator" | "authorNickname" | "likeCount" | "favoriteCount" | "liked" | "faved">;

type Tab = "recommend" | "follow";

const HomePage = () => {
  const { tokens } = useAuth();
  const accessToken = tokens?.accessToken ?? null;
  const isLoggedIn = !!accessToken;

  // 推荐 tab state（现状，保持只加载第 1 页）
  const [recommendItems, setRecommendItems] = useState<FeedEntry[]>([]);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [recommendError, setRecommendError] = useState<string | null>(null);

  // 关注 tab state（顶层持有，tab 切换不 unmount）
  const [followItems, setFollowItems] = useState<FeedEntry[]>([]);
  const [followLoading, setFollowLoading] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);
  const [followHasMore, setFollowHasMore] = useState(false);
  const followNextCursorRef = useRef<string | null>(null);
  const followHasFetchedRef = useRef(false);

  const [tab, setTab] = useState<Tab>("recommend");

  // 推荐 tab 首屏（沿用现状）
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setRecommendLoading(true);
      setRecommendError(null);
      try {
        const resp = await knowpostService.feed(1, 20);
        if (!cancelled) setRecommendItems(resp.items ?? []);
      } catch (err) {
        if (!cancelled) setRecommendError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (!cancelled) setRecommendLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  // 登出时重置关注 tab state（防跨账号 stale data：登出再换号登录不显示上个用户的关注 feed）
  useEffect(() => {
    if (!accessToken) {
      followHasFetchedRef.current = false;
      setFollowItems([]);
      setFollowError(null);
      setFollowHasMore(false);
      followNextCursorRef.current = null;
      setTab("recommend");
    }
  }, [accessToken]);

  // 关注 tab 首屏：只在首次切到关注 tab 时跑（hasFetched ref 防重跑，切回不覆盖）
  useEffect(() => {
    if (tab !== "follow") return;
    if (followHasFetchedRef.current) return;
    if (!accessToken) return;
    followHasFetchedRef.current = true;
    let cancelled = false;
    const run = async () => {
      setFollowLoading(true);
      setFollowError(null);
      try {
        const resp = await knowpostService.followFeed(null, accessToken);
        if (!cancelled) {
          setFollowItems(resp.items ?? []);
          followNextCursorRef.current = resp.nextCursor ?? null;
          setFollowHasMore(!!resp.hasMore);
        }
      } catch (err) {
        if (!cancelled) setFollowError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (!cancelled) setFollowLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [tab, accessToken]);

  const loadMoreFollow = async () => {
    if (followLoading || !followHasMore || !accessToken) return;
    const cursor = followNextCursorRef.current;
    setFollowLoading(true);
    setFollowError(null);
    try {
      const resp = await knowpostService.followFeed(cursor, accessToken);
      setFollowItems(prev => [...prev, ...(resp.items ?? [])]);
      followNextCursorRef.current = resp.nextCursor ?? null;
      setFollowHasMore(!!resp.hasMore);
    } catch (err) {
      setFollowError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setFollowLoading(false);
    }
  };

  const renderFeedList = (items: FeedEntry[], loading: boolean, error: string | null) => (
    <>
      {error ? <div>{error}</div> : null}
      <div className={styles.masonry}>
        {items.map(item => (
          <div key={item.id} className={styles.masonryItem}>
            <CourseCard
              id={item.id}
              title={item.title}
              summary={item.description ?? ""}
              tags={item.tags ?? []}
              authorTags={(() => {
                try {
                  return item.tagJson ? (JSON.parse(item.tagJson) as unknown[]).filter((t) => typeof t === "string") as string[] : [];
                } catch {
                  return [];
                }
              })()}
              teacher={{ name: item.authorNickname, avatarUrl: item.authorAvatar ?? item.authorAvator }}
              coverImage={item.coverImage}
              to={`/post/${item.id}`}
              footerExtra={<LikeFavBar entityId={item.id} compact initialCounts={{ like: item.likeCount ?? 0, fav: item.favoriteCount ?? 0 }} initialState={{ liked: item.liked, faved: item.faved }} />}
            />
          </div>
        ))}
        {loading ? <div className={styles.masonryItem}><div>加载中…</div></div> : null}
        {!loading && items.length === 0 && !error ? (
          <div className={styles.masonryItem}><div>暂无内容</div></div>
        ) : null}
      </div>
    </>
  );

  return (
    <AppLayout
      header={
        <MainHeader
          headline="知光 · 让思想有温度，让知识会发光"
          rightSlot={<AuthStatus />}
        />
      }
    >
      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${tab === "recommend" ? styles.tabActive : ""}`}
          onClick={() => setTab("recommend")}
        >
          推荐
        </button>
        {isLoggedIn ? (
          <button
            type="button"
            className={`${styles.tab} ${tab === "follow" ? styles.tabActive : ""}`}
            onClick={() => setTab("follow")}
          >
            关注
          </button>
        ) : null}
      </div>

      {/* 三目渲染：tab 切换不 unmount 对侧 state */}
      {tab === "follow" && isLoggedIn ? (
        <>
          {followError ? <div>{followError}</div> : null}
          <div className={styles.masonry}>
            {followItems.map(item => (
              <div key={item.id} className={styles.masonryItem}>
                <CourseCard
                  id={item.id}
                  title={item.title}
                  summary={item.description ?? ""}
                  tags={item.tags ?? []}
                  authorTags={(() => {
                    try {
                      return item.tagJson ? (JSON.parse(item.tagJson) as unknown[]).filter((t) => typeof t === "string") as string[] : [];
                    } catch {
                      return [];
                    }
                  })()}
                  teacher={{ name: item.authorNickname, avatarUrl: item.authorAvatar ?? item.authorAvator }}
                  coverImage={item.coverImage}
                  to={`/post/${item.id}`}
                  footerExtra={<LikeFavBar entityId={item.id} compact initialCounts={{ like: item.likeCount ?? 0, fav: item.favoriteCount ?? 0 }} initialState={{ liked: item.liked, faved: item.faved }} />}
                />
              </div>
            ))}
            {followLoading ? <div className={styles.masonryItem}><div>加载中…</div></div> : null}
            {!followLoading && followItems.length === 0 && !followError ? (
              <div className={styles.masonryItem}>
                <div>还没有关注的内容，<Link to="/search">去发现更多</Link></div>
              </div>
            ) : null}
          </div>
          {followHasMore && !followLoading ? (
            <div className={styles.masonryItem}>
              <button type="button" className={styles.tab} onClick={loadMoreFollow} disabled={followLoading}>加载更多</button>
            </div>
          ) : null}
        </>
      ) : (
        renderFeedList(recommendItems, recommendLoading, recommendError)
      )}
    </AppLayout>
  );
};

export default HomePage;
