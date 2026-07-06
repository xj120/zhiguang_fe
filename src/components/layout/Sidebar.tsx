import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { CreateIcon, HomeIcon, ProfileIcon, SearchIcon, SparkIcon, StudyIcon } from "@/components/icons/Icon";
import { useAuth } from "@/context/AuthContext";
import { notificationService } from "@/services/notificationService";
import styles from "./Sidebar.module.css";

const navItems = [
  { to: "/", label: "首页", Icon: HomeIcon },
  { to: "/search", label: "搜索", Icon: SearchIcon },
  { to: "/create", label: "创作", Icon: CreateIcon },
  { to: "/learn", label: "学习", Icon: StudyIcon },
  { to: "/profile", label: "我的", Icon: ProfileIcon }
] as const;

// 通知铃铛图标（内联，仓库无现成通知 icon）
const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const Sidebar = () => {
  const { tokens } = useAuth();
  const isLoggedIn = !!tokens?.accessToken;
  const [unread, setUnread] = useState(0);

  // 徽章两时机拉取：(a) Sidebar 挂载且已登录时
  useEffect(() => {
    if (!isLoggedIn) {
      setUnread(0);
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const resp = await notificationService.unreadCount(tokens!.accessToken);
        if (!cancelled) setUnread(resp.unreadCount ?? 0);
      } catch {
        // 静默失败，徽章不阻塞
      }
    };
    run();
    return () => { cancelled = true; };
  }, [isLoggedIn, tokens?.accessToken]);

  // 监听 NotificationPage 的标记已读事件，本地同步减
  useEffect(() => {
    const onRead = (e: Event) => {
      const detail = (e as CustomEvent).detail as { count?: number } | undefined;
      setUnread(prev => Math.max(0, prev - (detail?.count ?? 1)));
    };
    const onReadAll = () => setUnread(0);
    window.addEventListener("notification-read", onRead);
    window.addEventListener("notification-read-all", onReadAll);
    return () => {
      window.removeEventListener("notification-read", onRead);
      window.removeEventListener("notification-read-all", onReadAll);
    };
  }, []);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <SparkIcon width={30} height={30} stroke="none" fill="#fff" />
      </div>
      <nav className={styles.nav}>
        {navItems.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) => (isActive ? `${styles.link} ${styles.linkActive}` : styles.link)}
          >
            <Icon />
            {label}
          </NavLink>
        ))}
        {isLoggedIn ? (
          <NavLink
            to="/notifications"
            className={({ isActive }) => (isActive ? `${styles.link} ${styles.linkActive}` : styles.link)}
          >
            <BellIcon />
            通知
            {unread > 0 ? <span className={styles.badge}>{unread > 99 ? "99+" : unread}</span> : null}
          </NavLink>
        ) : null}
      </nav>
      <div className={styles.divider} />
      <div className={styles.footer}>
        <span>知光</span>
        <div>让知识发光</div>
      </div>
    </aside>
  );
};

export default Sidebar;
