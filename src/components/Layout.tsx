import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, FolderKanban, GanttChart, Settings, Plus, Bell, Search, ChevronRight, Archive } from "lucide-react";
import { systemApi } from "@/lib/tauri-api";
import { getInitials } from "@/lib/formatUtils";
import { useProjectStore } from "@/stores/useProjectStore";
import { useNotificationStore } from "@/stores/useNotificationStore";
import { useUserStore } from "@/stores/useUserStore";
import { useEffect } from "react";
import NotificationCenter from "@/components/notifications/NotificationCenter";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "概览" },
  { to: "/projects", icon: FolderKanban, label: "项目" },
  { to: "/gantt", icon: GanttChart, label: "甘特图" },
  { to: "/archive", icon: Archive, label: "归档" },
  { to: "/settings", icon: Settings, label: "设置" },
];

export default function Layout() {
  const { projects, fetchProjects } = useProjectStore();
  const { unreadCount, fetchHistory, fetchPreferences, setupListeners } = useNotificationStore();
  const { user, fetchUser } = useUserStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const [collapsed] = useState(false);

  useEffect(() => {
    fetchProjects();
    fetchHistory();
    fetchPreferences();
    fetchUser();
    setupListeners();
  }, [fetchProjects, fetchHistory, fetchPreferences, fetchUser, setupListeners]);

  return (
    <div className="flex h-screen" style={{ background: "var(--bg-void)" }}>
      {/* 侧边栏 */}
      <aside
        className={`relative flex flex-col shrink-0 border-r transition-all duration-300 ${
          collapsed ? "w-16" : ""
        }`}
        style={{
          width: collapsed ? undefined : "var(--sidebar-width)",
          background: "var(--sidebar-bg)",
          borderColor: "var(--sidebar-border)",
        }}
      >
        {/* ── Logo 区 ── */}
        <div
          className="flex items-center justify-between py-4 px-4 border-b"
          style={{ borderColor: "var(--sidebar-border)" }}
        >
          <div className="flex items-center gap-2.5">
            <svg
              viewBox="0 0 100 100"
              fill="none"
              className="w-8 h-8"
              style={{ color: "var(--sidebar-text)" }}
            >
              <path d="M26,8 L64,8 L82,26 L82,92 L26,92 Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              <path d="M64,8 L64,26 L82,26" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
              <line x1="36" y1="36" x2="56" y2="36" stroke="currentColor" strokeWidth="1" opacity="0.25" strokeLinecap="round" />
              <line x1="36" y1="78" x2="54" y2="78" stroke="currentColor" strokeWidth="1" opacity="0.25" strokeLinecap="round" />
              <line x1="36" y1="86" x2="46" y2="86" stroke="currentColor" strokeWidth="1" opacity="0.25" strokeLinecap="round" />
              <path
                d="M34,57 C40,36 52,36 52,53 C52,70 64,70 66,50"
                stroke="var(--gold)"
                strokeWidth="2.4"
                strokeLinecap="round"
                style={{ filter: "drop-shadow(0 0 3px rgba(201,168,76,0.35))" }}
              />
            </svg>
            <span
              className="text-xs uppercase tracking-wider font-medium"
              style={{ color: "var(--sidebar-text)" }}
            >
              Fileosophy
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              className="p-1.5 rounded-lg transition-all duration-200 ease-in-out"
              style={{ color: "var(--sidebar-text-muted)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sidebar-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              aria-label="搜索"
              onClick={() => window.dispatchEvent(new CustomEvent("global-shortcut", { detail: "global_search" }))}
            >
              <Search size={16} strokeWidth={1.5} />
            </button>
            <button
              className="relative p-1.5 rounded-lg transition-all duration-200 ease-in-out"
              style={{ color: "var(--sidebar-text-muted)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sidebar-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              aria-label="通知"
              onClick={() => setShowNotifications(true)}
            >
              <Bell size={16} strokeWidth={1.5} />
              {unreadCount > 0 && (
                <span
                  className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full"
                  style={{ background: "var(--gold)" }}
                />
              )}
            </button>
          </div>
        </div>

        {/* ── 导航区 ── */}
        <nav className="px-3 pt-4 pb-3 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ease-in-out ${
                  isActive ? "font-normal" : "font-light"
                }`
              }
              style={({ isActive }) => ({
                background: isActive ? "var(--sidebar-active)" : "transparent",
                color: isActive ? "var(--gold)" : "var(--sidebar-text)",
                borderLeft: isActive ? "2px solid var(--gold)" : "2px solid transparent",
              })}
              onMouseEnter={(e) => {
                const isActive = e.currentTarget.classList.contains("active");
                if (!isActive) e.currentTarget.style.background = "var(--sidebar-hover)";
              }}
              onMouseLeave={(e) => {
                const isActive = e.currentTarget.classList.contains("active");
                if (!isActive) e.currentTarget.style.background = "transparent";
              }}
            >
              <Icon
                size={18}
                strokeWidth={1.5}
                className="transition-colors duration-200"
                style={{ color: "inherit" }}
              />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* ── 分割线 ── */}
        <div
          className="mx-4 my-2 h-px"
          style={{ background: "var(--sidebar-border)" }}
        />

        {/* ── 最近项目区 ── */}
        <div className="flex-1 px-3 pt-2 pb-2 overflow-y-auto scrollbar-hide">
          <div
            className="px-3 py-1.5 text-[10px] uppercase tracking-widest"
            style={{ color: "var(--sidebar-text-muted)" }}
          >
            最近项目
          </div>
          <div className="space-y-0.5">
            {projects.slice(0, 8).map((project) => (
              <NavLink
                key={project.id}
                to={`/project/${project.id}`}
                className={({ isActive }) =>
                  `group flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all duration-200 ease-in-out truncate ${
                    isActive ? "font-normal" : "font-light"
                  }`
                }
                style={({ isActive }) => ({
                  background: isActive ? "var(--sidebar-active)" : "transparent",
                  color: isActive ? "var(--sidebar-text)" : "var(--sidebar-text-muted)",
                })}
                onMouseEnter={(e) => {
                  const isActive = e.currentTarget.classList.contains("active");
                  if (!isActive) {
                    e.currentTarget.style.background = "var(--sidebar-hover)";
                    e.currentTarget.style.color = "var(--sidebar-text)";
                  }
                }}
                onMouseLeave={(e) => {
                  const isActive = e.currentTarget.classList.contains("active");
                  if (!isActive) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--sidebar-text-muted)";
                  }
                }}
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span
                        className="w-[3px] h-[3px] rounded-full shrink-0"
                        style={{ background: "var(--gold)" }}
                      />
                    )}
                    <span className="truncate">{project.name}</span>
                  </>
                )}
              </NavLink>
            ))}
            <NavLink
              to="/projects"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all duration-200 ease-in-out"
              style={{ color: "var(--sidebar-text-muted)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--sidebar-text)";
                e.currentTarget.style.background = "var(--sidebar-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--sidebar-text-muted)";
                e.currentTarget.style.background = "transparent";
              }}
            >
              <Plus size={12} strokeWidth={1.5} />
              <span>查看全部</span>
            </NavLink>
          </div>
        </div>

        {/* ── 用户区 ── */}
        <NavLink
          to="/settings?tab=profile"
          className="flex items-center gap-2.5 px-4 py-3 border-t transition-all duration-200 ease-in-out"
          style={{
            borderColor: "var(--sidebar-border)",
            color: "var(--sidebar-text)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sidebar-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          {user?.avatar_path ? (
            <img
              src={systemApi.convertFileSrc(user.avatar_path)}
              alt="头像"
              className="w-8 h-8 rounded-full object-cover shrink-0"
              style={{ boxShadow: "0 0 0 1.5px var(--sidebar-border)" }}
            />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] shrink-0"
              style={{
                background: "var(--sidebar-active)",
                color: "var(--gold)",
                boxShadow: "0 0 0 1.5px var(--sidebar-border)",
              }}
            >
              {user?.name ? getInitials(user.name) : "?"}
            </div>
          )}
          <span className="text-sm truncate flex-1">
            {user?.name || "设置用户资料"}
          </span>
          <ChevronRight size={14} strokeWidth={1.5} style={{ color: "var(--sidebar-text-muted)" }} />
        </NavLink>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 overflow-auto" style={{ scrollbarGutter: "stable" }}>
        <Outlet />
      </main>

      {/* 通知中心 */}
      <NotificationCenter
        open={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
    </div>
  );
}
