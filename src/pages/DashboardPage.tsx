import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, PlayCircle, ClipboardList, PauseCircle,
  CheckCircle2, FolderOpen, Archive, BookMarked, ListTodo,
} from "lucide-react";
import { useProjectStore } from "@/stores/useProjectStore";
import { kanbanApi } from "@/lib/tauri-api";
import type { KanbanCard } from "@/types";

// ── 状态卡片配置 ──────────────────────────────────────────────

interface StatusCardConfig {
  key: string;
  label: string;
  icon: React.ReactNode;
  filterUrl: string;
  color: string;
}

const STATUS_CARDS: StatusCardConfig[] = [
  { key: "in_progress", label: "进行中", icon: <PlayCircle size={22} strokeWidth={1.5} />, filterUrl: "/projects?status=in_progress", color: "var(--status-in-progress)" },
  { key: "planning",    label: "规划中", icon: <ClipboardList size={22} strokeWidth={1.5} />, filterUrl: "/projects?status=planning", color: "var(--gold)" },
  { key: "on_hold",     label: "已暂停", icon: <PauseCircle size={22} strokeWidth={1.5} />, filterUrl: "/projects?status=on_hold", color: "var(--color-warning)" },
  { key: "completed_this_month", label: "本月完成", icon: <CheckCircle2 size={22} strokeWidth={1.5} />, filterUrl: "/projects?status=completed&month=current", color: "var(--color-success)" },
  { key: "total",       label: "全部项目", icon: <FolderOpen size={22} strokeWidth={1.5} />, filterUrl: "/projects", color: "var(--text-secondary)" },
  { key: "archived",    label: "已归档", icon: <Archive size={22} strokeWidth={1.5} />, filterUrl: "/projects?status=cancelled", color: "var(--text-muted)" },
];

// ── 动画 keyframes ────────────────────────────────────────────

const ANIM_KEYFRAMES = `
@keyframes dashFadeSlideUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes dashSearchFadeIn {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

function AnimStyles() {
  return <style>{ANIM_KEYFRAMES}</style>;
}

// ── 主组件 ──────────────────────────────────────────────────

export default function DashboardPage() {
  const { projects, fetchProjects } = useProjectStore();

  useEffect(() => {
    if (projects.length === 0) fetchProjects();
  }, [projects.length, fetchProjects]);

  // ── 卡片计数 ──

  const counts = useMemo(() => {
    const now = new Date();
    const thisMonth = now.toISOString().slice(0, 7);
    return {
      in_progress: projects.filter(p => p.status === "in_progress").length,
      planning:    projects.filter(p => p.status === "planning").length,
      on_hold:     projects.filter(p => p.status === "on_hold").length,
      completed_this_month: projects.filter(p =>
        p.status === "completed" && p.updated_at && p.updated_at.slice(0, 7) === thisMonth
      ).length,
      total:       projects.length,
      archived:    projects.filter(p => p.status === "cancelled").length,
    };
  }, [projects]);

  // ── 待办事项聚合 ──

  const [todoCards, setTodoCards] = useState<(KanbanCard & { projectName: string })[]>([]);
  const [todoLoading, setTodoLoading] = useState(false);

  const fetchTodos = useCallback(async () => {
    const activeProjects = projects.filter(p => p.status !== "completed" && p.status !== "cancelled");
    if (activeProjects.length === 0) return;
    setTodoLoading(true);
    try {
      const results = await Promise.allSettled(
        activeProjects.slice(0, 10).map(p =>
          kanbanApi.getBoard(p.id).then(board => ({
            projectName: p.name,
            cards: board.columns
              .filter(c => c.column_type === "todo_pending")
              .flatMap(c => c.cards ?? []),
          }))
        )
      );
      const all: (KanbanCard & { projectName: string })[] = [];
      for (const r of results) {
        if (r.status === "fulfilled") {
          for (const card of r.value.cards) {
            all.push({ ...card, projectName: r.value.projectName });
          }
        }
      }
      setTodoCards(all.slice(0, 10));
    } catch {
      // ignore
    } finally {
      setTodoLoading(false);
    }
  }, [projects]);

  useEffect(() => {
    if (projects.length > 0) fetchTodos();
  }, [projects, fetchTodos]);

  // ── 搜索跳转 ──

  const handleSearchFocus = () => {
    window.dispatchEvent(new CustomEvent("global-shortcut", { detail: "global_search" }));
  };

  return (
    <div style={{ padding: "40px 48px 48px", minHeight: "100%" }}>
      <AnimStyles />

      {/* ── 搜索栏 ── */}
      <div
        style={{
          animation: "dashSearchFadeIn 0.5s var(--ease-liquid) both",
          marginBottom: 40,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: 520,
          }}
        >
          <Search
            size={16}
            strokeWidth={1.5}
            style={{
              position: "absolute",
              left: 16,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            readOnly
            onFocus={handleSearchFocus}
            onClick={handleSearchFocus}
            placeholder="搜索项目、卡片、任务、文件… (⌘⇧F)"
            style={{
              width: "100%",
              height: 44,
              padding: "0 16px 0 42px",
              fontSize: 14,
              fontFamily: "inherit",
              color: "var(--text-tertiary)",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-lg)",
              outline: "none",
              cursor: "pointer",
              transition: "border-color var(--duration-base) var(--ease-smooth), box-shadow var(--duration-base) var(--ease-smooth)",
              boxShadow: "var(--shadow-sm)",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = "var(--gold)";
              e.currentTarget.style.boxShadow = "var(--shadow-gold)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = "var(--border-default)";
              e.currentTarget.style.boxShadow = "var(--shadow-sm)";
            }}
          />
        </div>
      </div>

      {/* ── 状态卡片网格 (2x3) ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 20,
          marginBottom: 48,
        }}
      >
        {STATUS_CARDS.map((card, i) => (
          <StatusCard
            key={card.key}
            config={card}
            count={counts[card.key as keyof typeof counts] ?? 0}
            delay={i * 0.08}
          />
        ))}
      </div>

      {/* ── 底部双栏 ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* 左栏：标记文件 */}
        <div
          className="card"
          style={{
            animation: "dashFadeSlideUp 0.5s var(--ease-liquid) 0.5s both",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <BookMarked size={16} strokeWidth={1.5} style={{ color: "var(--gold)" }} />
            <h3 style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 500,
              color: "var(--text-primary)",
              fontFamily: "var(--font-display)",
              letterSpacing: "0.01em",
            }}>
              标记文件
            </h3>
          </div>
          <div style={{
            textAlign: "center",
            padding: "32px 0",
            color: "var(--text-muted)",
            fontSize: 13,
          }}>
            <BookMarked size={28} strokeWidth={1.2} style={{ marginBottom: 8, opacity: 0.4 }} />
            <p style={{ margin: 0 }}>暂无标记文件</p>
          </div>
        </div>

        {/* 右栏：待办事项 */}
        <div
          className="card"
          style={{
            animation: "dashFadeSlideUp 0.5s var(--ease-liquid) 0.6s both",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <ListTodo size={16} strokeWidth={1.5} style={{ color: "var(--gold)" }} />
            <h3 style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 500,
              color: "var(--text-primary)",
              fontFamily: "var(--font-display)",
              letterSpacing: "0.01em",
            }}>
              待办事项
            </h3>
          </div>
          {todoLoading ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: 13 }}>
              加载中…
            </div>
          ) : todoCards.length === 0 ? (
            <div style={{
              textAlign: "center",
              padding: "32px 0",
              color: "var(--text-muted)",
              fontSize: 13,
            }}>
              <ListTodo size={28} strokeWidth={1.2} style={{ marginBottom: 8, opacity: 0.4 }} />
              <p style={{ margin: 0 }}>暂无待办事项</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {todoCards.map((card, i) => (
                <TodoItem key={card.id} card={card} delay={0.65 + i * 0.05} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── StatusCard 子组件 ──────────────────────────────────────────

function StatusCard({
  config,
  count,
  delay = 0,
}: {
  config: StatusCardConfig;
  count: number;
  delay?: number;
}) {
  const [hovered, setHovered] = useState(false);
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(config.filterUrl)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--bg-surface)",
        border: `1px solid ${hovered ? config.color : "var(--border-default)"}`,
        borderRadius: "var(--radius-md)",
        padding: "24px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 18,
        transition: `
          transform var(--duration-base) var(--ease-liquid),
          box-shadow var(--duration-base) var(--ease-liquid),
          border-color var(--duration-base) var(--ease-smooth)
        `,
        transform: hovered ? "translateY(-3px)" : "translateY(0)",
        boxShadow: hovered ? "var(--shadow-lg)" : "var(--shadow-sm)",
        animation: `dashFadeSlideUp 0.5s var(--ease-liquid) ${delay}s both`,
      }}
    >
      {/* 图标 */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "var(--radius-sm)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          background: `color-mix(in srgb, ${config.color} 10%, transparent)`,
          color: config.color,
          border: `1px solid color-mix(in srgb, ${config.color} 30%, transparent)`,
          transition: "transform var(--duration-base) var(--ease-liquid)",
          transform: hovered ? "scale(1.08)" : "scale(1)",
        }}
      >
        {config.icon}
      </div>

      {/* 文字 */}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize: 12,
          letterSpacing: "0.05em",
          color: "var(--text-muted)",
          marginBottom: 4,
        }}>
          {config.label}
        </div>
        <div style={{
          fontSize: 26,
          fontWeight: 500,
          color: "var(--text-primary)",
          lineHeight: 1.1,
          fontFamily: "var(--font-display)",
        }}>
          {count}
        </div>
      </div>
    </div>
  );
}

// ── TodoItem 子组件 ──────────────────────────────────────────

function TodoItem({
  card,
  delay = 0,
}: {
  card: KanbanCard & { projectName: string };
  delay?: number;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "10px 8px",
        borderRadius: "var(--radius-sm)",
        transition: "background var(--duration-fast) var(--ease-smooth)",
        background: hovered ? "var(--gold-glow)" : "transparent",
        animation: `dashFadeSlideUp 0.35s var(--ease-liquid) ${delay}s both`,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: "var(--radius-full)",
          background: "var(--gold)",
          flexShrink: 0,
        }}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize: 13,
          color: "var(--text-primary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap" as const,
        }}>
          {card.title}
        </div>
        <div style={{
          fontSize: 11,
          color: "var(--text-muted)",
          marginTop: 1,
        }}>
          {card.projectName}
        </div>
      </div>
    </div>
  );
}
