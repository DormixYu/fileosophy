import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FolderKanban, TrendingUp, Clock, CheckCircle2, Pause,
  PlusCircle, RefreshCw, AlertTriangle, CalendarX, Tag, Settings2,
} from "lucide-react";
import { systemApi } from "@/lib/tauri-api";
import { useProjectStore } from "@/stores/useProjectStore";
import { useUserStore } from "@/stores/useUserStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { getInitials, formatDate } from "@/lib/formatUtils";
import Spinner from "@/components/common/Spinner";
import EmptyState from "@/components/common/EmptyState";
import type { Project, ProjectTypeConfig } from "@/types";

// ── 卡片配置 ──────────────────────────────────────────────────

const STATIC_CARDS = [
  { id: "total", label: "项目总数" },
  { id: "active", label: "活跃项目" },
  { id: "completed_this_year", label: "本年已完成" },
  { id: "on_hold", label: "已暂停" },
  { id: "created_this_month", label: "本月新增" },
  { id: "updated_recently", label: "近7日更新" },
  { id: "overdue", label: "逾期项目" },
  { id: "due_soon", label: "即将到期" },
  { id: "no_end_date", label: "无截止日期" },
];

const CARD_GROUPS = [
  { label: "基础统计", ids: ["total", "active", "on_hold"] },
  { label: "时间统计", ids: ["completed_this_year", "created_this_month", "updated_recently", "overdue", "due_soon", "no_end_date"] },
];

const ICON_MAP: Record<string, React.ReactNode> = {
  total: <FolderKanban size={18} strokeWidth={1.5} />,
  active: <TrendingUp size={18} strokeWidth={1.5} />,
  completed_this_year: <CheckCircle2 size={18} strokeWidth={1.5} />,
  on_hold: <Pause size={18} strokeWidth={1.5} />,
  created_this_month: <PlusCircle size={18} strokeWidth={1.5} />,
  updated_recently: <RefreshCw size={18} strokeWidth={1.5} />,
  overdue: <AlertTriangle size={18} strokeWidth={1.5} />,
  due_soon: <Clock size={18} strokeWidth={1.5} />,
  no_end_date: <CalendarX size={18} strokeWidth={1.5} />,
};

const DEFAULT_DASHBOARD_CARDS = ["total", "active", "completed_this_year"];
const DASHBOARD_CARDS_KEY = "dashboard_cards";
const MAX_CARDS = 4;

function computeCardValue(id: string, projects: Project[]): string {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const thisYear = String(now.getFullYear());
  const thisMonth = today.slice(0, 7);
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const nextWeek = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const isActive = (p: Project) => p.status !== "completed" && p.status !== "cancelled";

  if (id.startsWith("type_")) {
    const typeId = id.slice(5);
    return String(projects.filter(p => p.project_type === typeId).length);
  }
  switch (id) {
    case "total": return String(projects.length);
    case "active": return String(projects.filter(isActive).length);
    case "completed_this_year": return String(projects.filter(p => p.status === "completed" && ((p.end_date && p.end_date.slice(0, 4) === thisYear) || (p.updated_at && p.updated_at.slice(0, 4) === thisYear))).length);
    case "on_hold": return String(projects.filter(p => p.status === "on_hold").length);
    case "created_this_month": return String(projects.filter(p => p.created_at && p.created_at.slice(0, 7) === thisMonth).length);
    case "updated_recently": return String(projects.filter(p => p.updated_at && p.updated_at.slice(0, 10) >= weekAgo).length);
    case "overdue": return String(projects.filter(p => isActive(p) && p.end_date && p.end_date.slice(0, 10) < today).length);
    case "due_soon": return String(projects.filter(p => isActive(p) && p.end_date && p.end_date.slice(0, 10) >= today && p.end_date.slice(0, 10) <= nextWeek).length);
    case "no_end_date": return String(projects.filter(p => isActive(p) && !p.end_date).length);
    default: return "0";
  }
}

function getCardLabel(id: string, types: ProjectTypeConfig[]): string {
  if (id.startsWith("type_")) {
    const t = types.find(t => t.id === id.slice(5));
    return t ? `${t.name}项目` : id;
  }
  return STATIC_CARDS.find(c => c.id === id)?.label || id;
}

function getCardIcon(id: string): React.ReactNode {
  if (id.startsWith("type_")) return <Tag size={18} strokeWidth={1.5} />;
  return ICON_MAP[id] || <FolderKanban size={18} strokeWidth={1.5} />;
}

// ── 主组件 ──────────────────────────────────────────────────

export default function DashboardPage() {
  const { projects, fetchProjects, loading } = useProjectStore();
  const { user, fetchUser } = useUserStore();
  const { settings, parsedTypes, saveSettings } = useSettingsStore();
  const navigate = useNavigate();
  const [showCardSelector, setShowCardSelector] = useState(false);

  useEffect(() => {
    if (projects.length === 0) fetchProjects();
    fetchUser();
  }, [projects.length, fetchProjects, fetchUser]);

  const activeCount = useMemo(
    () => projects.filter(p => p.status !== "completed" && p.status !== "cancelled").length,
    [projects]
  );

  const activeProjects = useMemo(
    () =>
      projects
        .filter((p) => p.status !== "completed" && p.status !== "cancelled")
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 6),
    [projects]
  );

  // 选中卡片
  const selectedCards = useMemo(() => {
    try {
      const raw = settings[DASHBOARD_CARDS_KEY];
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length > 0) return arr.slice(0, MAX_CARDS) as string[];
      }
    } catch { /* ignore */ }
    return DEFAULT_DASHBOARD_CARDS;
  }, [settings]);

  // 卡片数值
  const cardValues = useMemo(() => {
    const map: Record<string, string> = {};
    for (const id of selectedCards) {
      map[id] = computeCardValue(id, projects);
    }
    return map;
  }, [projects, selectedCards]);

  const toggleCard = (id: string) => {
    const next = selectedCards.includes(id)
      ? selectedCards.filter(v => v !== id)
      : [...selectedCards, id].slice(0, MAX_CARDS);
    if (next.length === 0) return; // 不允许全部取消
    saveSettings({ [DASHBOARD_CARDS_KEY]: JSON.stringify(next) });
  };

  return (
    <div className="px-10 pt-10 pb-12 animate-fade-up">
      {/* 品牌欢迎区 */}
      <div className="mb-10">
        <div className="flex items-center gap-5 mb-4">
          {user?.avatar_path ? (
            <img
              src={systemApi.convertFileSrc(user.avatar_path)}
              alt="头像"
              className="w-11 h-11 rounded-full object-cover shrink-0"
              style={{ border: "2px solid var(--gold)" }}
            />
          ) : (
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-serif shrink-0"
              style={{ background: "var(--gold-glow-strong)", color: "var(--gold)", border: "2px solid var(--gold)" }}
            >
              {user?.name ? getInitials(user.name) : "?"}
            </div>
          )}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-title font-serif mb-0" style={{ color: "var(--text-primary)" }}>
                {user?.name ? `欢迎回来，${user.name}` : "概览"}
              </h1>
              <div className="w-6 h-[2px] rounded-full" style={{ background: "var(--gold)", opacity: 0.6 }} />
            </div>
          </div>
        </div>
        <p className="text-callout" style={{ color: "var(--text-tertiary)" }}>
          这里是你的项目全貌
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-lg font-serif" style={{ color: "var(--text-muted)" }}>项目概览</span>
        <div className="relative">
          <button
            className="p-1 rounded-md transition-colors hover-gold-bg"
            style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
            onClick={() => setShowCardSelector(!showCardSelector)}
            title="自定义卡片"
          >
            <Settings2 size={14} strokeWidth={1.5} />
          </button>
          {showCardSelector && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowCardSelector(false)} />
              <CardSelector
                selectedCards={selectedCards}
                parsedTypes={parsedTypes}
                maxCards={MAX_CARDS}
                onToggle={toggleCard}
              />
            </>
          )}
        </div>
      </div>
      <div className="grid gap-5 mb-10" style={{ gridTemplateColumns: `repeat(${Math.min(selectedCards.length, 4)}, 1fr)` }}>
        {selectedCards.map(id => (
          <StatCard
            key={id}
            icon={getCardIcon(id)}
            label={getCardLabel(id, parsedTypes)}
            value={cardValues[id] || "0"}
          />
        ))}
      </div>

      {/* 活跃项目区 */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-serif" style={{ color: "var(--text-primary)" }}>
            活跃项目
          </h2>
          <span className="text-footnote" style={{ color: "var(--text-muted)" }}>
            {activeCount > 0 ? `${activeCount} 个` : ""}
          </span>
        </div>
        <Link to="/projects" className="btn btn-ghost btn-sm hover-gold-text" style={{ color: "var(--gold)" }}>
          查看全部
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-16 animate-fade-up">
          <Spinner />
          <p className="text-footnote mt-4" style={{ color: "var(--text-muted)" }}>
            正在加载...
          </p>
        </div>
      ) : activeProjects.length === 0 ? (
        <div className="animate-fade-up">
          <EmptyState
            icon={<FolderKanban size={24} strokeWidth={1.5} />}
            title="暂无活跃项目"
            description="创建第一个吧"
            action={{ label: "新建项目", onClick: () => navigate("/projects") }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-5 animate-fade-up">
          {activeProjects.map((project) => (
            <Link
              key={project.id}
              to={`/project/${project.id}`}
              className="card card-interactive hover-gold-border group"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-callout font-serif leading-snug" style={{ color: "var(--text-primary)" }}>
                  {project.name}
                </h3>
                {project.status && (
                  <span className="badge badge-primary ml-2 shrink-0">
                    {project.status === "in_progress" ? "进行中" :
                     project.status === "planning" ? "规划中" :
                     project.status === "completed" ? "已完成" :
                     project.status === "on_hold" ? "已暂停" :
                     project.status === "cancelled" ? "已取消" : project.status}
                  </span>
                )}
              </div>
              <p className="text-footnote line-clamp-2 mb-4" style={{ color: "var(--text-tertiary)" }}>
                {project.description || "暂无描述"}
              </p>
              <div className="text-caption" style={{ color: "var(--text-dim)" }}>
                更新于 {formatDate(project.updated_at)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 卡片选择器 ──────────────────────────────────────────────────

function CardSelector({
  selectedCards,
  parsedTypes,
  maxCards,
  onToggle,
}: {
  selectedCards: string[];
  parsedTypes: ProjectTypeConfig[];
  maxCards: number;
  onToggle: (id: string) => void;
}) {
  const isFull = selectedCards.length >= maxCards;

  return (
    <div
      className="absolute right-0 top-full mt-1 z-50 rounded-lg p-3 min-w-[200px] animate-fade-in"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-default)",
        boxShadow: "var(--shadow-gold-lg)",
      }}
    >
      <div className="text-[10px] mb-2" style={{ color: "var(--text-muted)" }}>
        选择最多 {maxCards} 个卡片（已选 {selectedCards.length}/{maxCards}）
      </div>

      {CARD_GROUPS.map(group => (
        <div key={group.label} className="mb-2">
          <div className="text-[10px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>
            {group.label}
          </div>
          {group.ids.map(id => (
            <label
              key={id}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors ${!selectedCards.includes(id) && isFull ? "opacity-40" : "hover-gold-bg"}`}
              style={{ color: selectedCards.includes(id) ? "var(--gold)" : "var(--text-secondary)" }}
            >
              <input
                type="checkbox"
                checked={selectedCards.includes(id)}
                disabled={!selectedCards.includes(id) && isFull}
                onChange={() => onToggle(id)}
                className="w-3 h-3 accent-[var(--gold)]"
              />
              {getCardIcon(id)}
              {getCardLabel(id, parsedTypes)}
            </label>
          ))}
        </div>
      ))}

      {/* 分类统计 */}
      {parsedTypes.length > 0 && (
        <div className="mb-2">
          <div className="text-[10px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>
            分类统计
          </div>
          {parsedTypes.map(t => {
            const id = `type_${t.id}`;
            return (
              <label
                key={id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors ${!selectedCards.includes(id) && isFull ? "opacity-40" : "hover-gold-bg"}`}
                style={{ color: selectedCards.includes(id) ? "var(--gold)" : "var(--text-secondary)" }}
              >
                <input
                  type="checkbox"
                  checked={selectedCards.includes(id)}
                  disabled={!selectedCards.includes(id) && isFull}
                  onChange={() => onToggle(id)}
                  className="w-3 h-3 accent-[var(--gold)]"
                />
                <Tag size={14} strokeWidth={1.5} />
                {t.name}项目
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="card">
      <div className="flex items-center gap-4">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: "var(--gold-glow-strong)",
            color: "var(--gold)",
            border: "1px solid var(--gold)",
          }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div
            className="text-footnote uppercase tracking-[0.15em] mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            {label}
          </div>
          <div
            className="text-xl font-serif truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}