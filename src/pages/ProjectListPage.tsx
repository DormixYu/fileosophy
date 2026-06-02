import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Search, Trash2, X, Calendar, ChevronDown, FolderOpen, LayoutGrid, List } from "lucide-react";
import { useProjectStore } from "@/stores/useProjectStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useNotificationStore } from "@/stores/useNotificationStore";
import { projectApi, archiveApi } from "@/lib/tauri-api";
import Modal from "@/components/common/Modal";
import DatePicker from "@/components/common/DatePicker";
import ProjectDialog from "@/components/project/ProjectDialog";
import BatchStatusDropdown from "@/components/project/BatchStatusDropdown";
import ProjectTable, { type SortState } from "@/components/project/ProjectTable";
import ProjectCard from "@/components/project/ProjectCard";
import type {
  Project,
  ProjectStatus,
} from "@/types";

interface SavedFilters {
  status: string[];
  type: string[];
  startDate: string;
  endDate: string;
}

const FILTERS_KEY = "project_filters";
const DEFAULT_FILTERS: SavedFilters = { status: [], type: [], startDate: "", endDate: "" };
const VIEW_MODE_KEY = "project_view_mode";

export default function ProjectListPage() {
  const { projects, fetchProjects, createProject, updateProject, deleteProject, loading, consumeCreateProject, pendingCreateProject } =
    useProjectStore();
  const { parsedStatuses, parsedTypes, parsedColumns } = useSettingsStore();
  const { addToast } = useNotificationStore();

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<SavedFilters>(() => {
    try {
      const raw = useSettingsStore.getState().settings[FILTERS_KEY];
      if (raw) return JSON.parse(raw) as SavedFilters;
    } catch { /* ignore parse errors */ }
    return DEFAULT_FILTERS;
  });
  const [sort, setSort] = useState<SortState>({ key: "updated_at", dir: "desc" });
  const [showCreate, setShowCreate] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);
  const [confirmArchiveId, setConfirmArchiveId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "card">(() => {
    try {
      const saved = useSettingsStore.getState().settings[VIEW_MODE_KEY];
      if (saved === "card" || saved === "table") return saved;
    } catch { /* ignore */ }
    return "table";
  });
  const selectAllRef = useRef<HTMLInputElement>(null);

  // 从 URL 搜索参数中读取筛选条件（Dashboard 跳转时传入）
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const statusParam = searchParams.get("status");
    if (statusParam) {
      setFilters(prev => {
        if (prev.status.includes(statusParam)) return prev;
        const next = { ...prev, status: [statusParam] };
        persistFilters(next);
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 筛选变更时自动持久化
  const persistFilters = useCallback((f: SavedFilters) => {
    useSettingsStore.getState().saveSettings({
      [FILTERS_KEY]: JSON.stringify(f),
    }).catch((e) => console.error("Failed to persist filters:", e));
  }, []);

  const updateFilter = useCallback((key: keyof SavedFilters, value: string[] | string) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      persistFilters(next);
      return next;
    });
  }, [persistFilters]);

  useEffect(() => {
    if (projects.length === 0) fetchProjects();
  }, [projects.length, fetchProjects]);

  // 检测快捷键触发的创建请求
  useEffect(() => {
    if (pendingCreateProject) {
      consumeCreateProject();
      setShowCreate(true);
    }
  }, [pendingCreateProject, consumeCreateProject]);

  // 检测快捷键触发的创建请求
  const visibleColumns = useMemo(
    () => parsedColumns.filter((c) => c.visible || c.fixed),
    [parsedColumns]
  );

  // 筛选 + 排序
  const filtered = useMemo(() => {
    let result = [...projects];

    // 搜索
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.project_number || "").toLowerCase().includes(q) ||
          (p.description || "").toLowerCase().includes(q)
      );
    }

    // 状态筛选
    if (filters.status.length > 0) {
      result = result.filter((p) => p.status !== null && filters.status.includes(p.status));
    }

    // 分类筛选
    if (filters.type.length > 0) {
      result = result.filter((p) => p.project_type !== null && filters.type.includes(p.project_type));
    }

    // 时间范围筛选
    if (filters.startDate) {
      result = result.filter((p) => {
        const d = p.start_date || p.created_at;
        return d && d.slice(0, 10) >= filters.startDate;
      });
    }
    if (filters.endDate) {
      result = result.filter((p) => {
        const d = p.end_date || p.updated_at;
        return d && d.slice(0, 10) <= filters.endDate;
      });
    }

    // 排序
    if (sort.key && sort.dir) {
      result.sort((a, b) => {
        const aVal = (a as unknown as Record<string, unknown>)[sort.key] ?? "";
        const bVal = (b as unknown as Record<string, unknown>)[sort.key] ?? "";
        const cmp = String(aVal).localeCompare(String(bVal), "zh-CN");
        return sort.dir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [projects, search, filters, sort]);

  const handleSort = (key: string) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return { key: "", dir: null };
    });
  };

  const handleColumnResizeLive = useCallback((colKey: string, newWidth: number) => {
    const updated = parsedColumns.map((c) =>
      c.key === colKey ? { ...c, width: Math.max(40, newWidth) } : c
    );
    useSettingsStore.setState({ parsedColumns: updated });
  }, [parsedColumns]);

  const handleColumnResizeEnd = useCallback(() => {
    const cols = useSettingsStore.getState().parsedColumns;
    useSettingsStore.getState().saveSettings({
      project_table_columns: JSON.stringify(cols),
    }).catch((e) => console.error("Failed to save column widths:", e));
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDeleteId(id);
  };

  const handleArchive = async (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmArchiveId(id);
  };

  const handleDoubleClick = async (project: Project) => {
    if (!project.folder_path) return;
    try {
      await projectApi.openFolder(project.folder_path);
    } catch (e) {
      console.error("打开文件夹失败:", e);
    }
  };

  const handleStatusChange = async (projectId: number, newStatus: ProjectStatus) => {
    try {
      await updateProject(projectId, { status: newStatus });
    } catch (e) {
      console.error("更新状态失败:", e);
    }
  };

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((p) => p.id)));
    }
  };

  const handleBatchStatusChange = async (newStatus: ProjectStatus) => {
    const ids = [...selectedIds];
    let successCount = 0;
    for (const id of ids) {
      try {
        await updateProject(id, { status: newStatus });
        successCount++;
      } catch {
        // 单个失败不影响其他
      }
    }
    setSelectedIds(new Set());
    if (successCount < ids.length) {
      console.warn(`批量更新状态: ${successCount}/${ids.length} 成功`);
    }
  };

  const handleBatchDelete = async () => {
    const ids = [...selectedIds];
    let successCount = 0;
    for (const id of ids) {
      try {
        await deleteProject(id);
        successCount++;
      } catch {
        // 单个失败不影响其他
      }
    }
    setSelectedIds(new Set());
    setConfirmBatchDelete(false);
    addToast({
      type: successCount === ids.length ? "success" : "warning",
      title: "批量删除",
      message: `已删除 ${successCount}/${ids.length} 个项目`,
    });
  };

  // indeterminate 状态同步
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selectedIds.size > 0 && selectedIds.size < filtered.length;
    }
  }, [selectedIds.size, filtered.length]);

  const hasActiveFilters = filters.status.length > 0 || filters.type.length > 0 || filters.startDate || filters.endDate;

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* 页头 */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0">
        <div>
          <h1 className="text-title" style={{ color: "var(--text-primary)" }}>
            项目
          </h1>
          <p className="text-caption mt-0.5" style={{ color: "var(--text-muted)" }}>
            {loading ? "加载中..." : `共 ${projects.length} 个项目`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={14} strokeWidth={1.5} />
            新建项目
          </button>
        </div>
      </div>

      {/* 工具栏 */}
      <div className="flex items-center gap-2 px-6 pb-3 shrink-0 flex-wrap">
        {/* 视图切换 */}
        <div
          className="flex items-center rounded-lg overflow-hidden"
          style={{ border: "1px solid var(--border-default)" }}
        >
          <button
            className="p-1.5 transition-colors"
            style={{
              background: viewMode === "table" ? "var(--gold-glow-strong)" : "transparent",
              color: viewMode === "table" ? "var(--gold)" : "var(--text-muted)",
              border: "none",
              cursor: "pointer",
            }}
            onClick={() => {
              setViewMode("table");
              useSettingsStore.getState().saveSettings({ [VIEW_MODE_KEY]: "table" }).catch(() => {});
            }}
            title="表格视图"
          >
            <List size={14} strokeWidth={1.5} />
          </button>
          <button
            className="p-1.5 transition-colors"
            style={{
              background: viewMode === "card" ? "var(--gold-glow-strong)" : "transparent",
              color: viewMode === "card" ? "var(--gold)" : "var(--text-muted)",
              border: "none",
              cursor: "pointer",
            }}
            onClick={() => {
              setViewMode("card");
              useSettingsStore.getState().saveSettings({ [VIEW_MODE_KEY]: "card" }).catch(() => {});
            }}
            title="卡片视图"
          >
            <LayoutGrid size={14} strokeWidth={1.5} />
          </button>
        </div>

        {/* 搜索 */}
        <div className="search-input-wrapper" style={{ maxWidth: 240 }}>
          <Search size={14} strokeWidth={1.5} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <input
            type="text"
            placeholder="搜索编号、名称..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}
            >
              <X size={12} strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* 分隔线 */}
        <div className="w-px h-5 mx-1" style={{ background: "var(--border-default)" }} />

        {/* 状态筛选 */}
        <MultiSelect
          label="状态"
          selected={filters.status}
          items={parsedStatuses.map(s => ({ id: s.id, name: s.name, color: s.color }))}
          onToggle={(id) => {
            const next = filters.status.includes(id)
              ? filters.status.filter(v => v !== id)
              : [...filters.status, id];
            updateFilter("status", next);
          }}
          onClear={() => updateFilter("status", [])}
        />

        {/* 分类筛选 */}
        <MultiSelect
          label="分类"
          selected={filters.type}
          items={parsedTypes.map(t => ({ id: t.id, name: t.name }))}
          onToggle={(id) => {
            const next = filters.type.includes(id)
              ? filters.type.filter(v => v !== id)
              : [...filters.type, id];
            updateFilter("type", next);
          }}
          onClear={() => updateFilter("type", [])}
        />

        {/* 时间范围 */}
        <div className="flex items-center gap-1.5">
          <Calendar size={13} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
          <DatePicker
            value={filters.startDate}
            onChange={(v) => updateFilter("startDate", v)}
            placeholder="起始日期"
            className="input-base !py-1 !px-2.5 !text-xs !rounded-full"
          />
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>至</span>
          <DatePicker
            value={filters.endDate}
            onChange={(v) => updateFilter("endDate", v)}
            className="input-base !py-1 !px-2.5 !text-xs !rounded-full"
            placeholder="截止日期"
          />
          {(filters.startDate || filters.endDate) && (
            <button
              className="p-0.5 rounded hover-gold-bg"
              style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
              onClick={() => { updateFilter("startDate", ""); updateFilter("endDate", ""); }}
              title="清除日期"
            >
              <X size={12} strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* 有筛选条件时显示清除按钮 */}
        {hasActiveFilters && (
          <button
            className="text-caption underline cursor-pointer transition-colors hover-gold-text"
            style={{ color: "var(--text-muted)", background: "none", border: "none" }}
            onClick={() => {
              setFilters(DEFAULT_FILTERS);
              persistFilters(DEFAULT_FILTERS);
            }}
          >
            清除筛选
          </button>
        )}

        <span className="text-caption ml-auto" style={{ color: "var(--text-muted)" }}>
          {filtered.length} 个项目
        </span>
      </div>

      {/* 表格区域 */}
      <div className={`flex-1 overflow-hidden mx-6 mb-5 ${viewMode === "table" ? "" : "overflow-auto"}`} style={{ borderRadius: "var(--radius-lg)", border: viewMode === "table" ? "1px solid var(--border-default)" : "none" }}>
        {loading ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState
            hasFilters={Boolean(hasActiveFilters || search.trim())}
            onCreateNew={() => setShowCreate(true)}
          />
        ) : viewMode === "card" ? (
          <div className="grid gap-4 p-1 animate-stagger" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                statuses={parsedStatuses}
                types={parsedTypes}
                onEdit={setEditProject}
                onDelete={handleDelete}
                onArchive={handleArchive}
              />
            ))}
          </div>
        ) : (
          <ProjectTable
            filtered={filtered}
            visibleColumns={visibleColumns}
            sort={sort}
            selectedIds={selectedIds}
            selectAllRef={selectAllRef}
            handleSort={handleSort}
            handleSelectAll={handleSelectAll}
            handleToggleSelect={handleToggleSelect}
            handleStatusChange={handleStatusChange}
            handleDoubleClick={handleDoubleClick}
            setEditProject={setEditProject}
            handleDelete={handleDelete}
            handleArchive={handleArchive}
            statuses={parsedStatuses}
            types={parsedTypes}
            onColumnResizeLive={handleColumnResizeLive}
            onColumnResizeEnd={handleColumnResizeEnd}
          />
        )}
      </div>

      {/* 新建项目弹窗 */}
      {showCreate && (
        <ProjectDialog
          title="新建项目"
          types={parsedTypes}
          statuses={parsedStatuses}
          onClose={() => setShowCreate(false)}
          onSubmit={async (data) => {
            await createProject(data);
            setShowCreate(false);
          }}
        />
      )}

      {/* 编辑项目弹窗 */}
      {editProject && (
        <ProjectDialog
          title="编辑项目"
          project={editProject}
          types={parsedTypes}
          statuses={parsedStatuses}
          onClose={() => setEditProject(null)}
          onSubmit={async (data) => {
            await updateProject(editProject.id, data);
            setEditProject(null);
          }}
        />
      )}

      {/* 底部批量操作浮窗 */}
      {selectedIds.size > 0 && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 animate-slide-up"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--gold)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-gold-lg)",
          }}
        >
          <span className="text-caption font-medium" style={{ color: "var(--gold)" }}>
            已选 {selectedIds.size} 项
          </span>
          <button
            className="p-1 rounded transition-colors hover-gold-bg"
            style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
            onClick={() => setSelectedIds(new Set())}
            title="取消选择"
          >
            <X size={14} strokeWidth={1.5} />
          </button>
          <div className="w-px h-5" style={{ background: "var(--border-default)" }} />
          <BatchStatusDropdown
            statuses={parsedStatuses}
            onApply={handleBatchStatusChange}
          />
          <button
            className="btn btn-ghost btn-sm hover-danger-text"
            style={{ color: "var(--text-muted)" }}
            onClick={() => setConfirmBatchDelete(true)}
          >
            <Trash2 size={12} strokeWidth={1.5} />
            批量删除
          </button>
        </div>
      )}

      {/* 批量删除确认弹窗 */}
      {confirmBatchDelete && (
        <Modal
          open={true}
          onClose={() => setConfirmBatchDelete(false)}
          title="批量删除确认"
          footer={
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmBatchDelete(false)}>取消</button>
              <button className="btn btn-danger btn-sm" onClick={handleBatchDelete}>
                删除 {selectedIds.size} 个项目
              </button>
            </>
          }
        >
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            确定删除选中的 {selectedIds.size} 个项目？所有数据将被清除，此操作不可撤销。
          </p>
        </Modal>
      )}

      {/* 删除确认弹窗 */}
      {confirmDeleteId !== null && (
        <Modal
          open={true}
          onClose={() => setConfirmDeleteId(null)}
          title="确认删除"
          footer={
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteId(null)}>取消</button>
              <button className="btn btn-danger btn-sm" onClick={async () => {
                await deleteProject(confirmDeleteId);
                setConfirmDeleteId(null);
              }}>删除</button>
            </>
          }
        >
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            确定删除该项目？所有数据将被清除。
          </p>
        </Modal>
      )}

      {/* 归档确认弹窗 */}
      {confirmArchiveId !== null && (
        <Modal
          open={true}
          onClose={() => setConfirmArchiveId(null)}
          title="确认归档"
          footer={
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmArchiveId(null)}>取消</button>
              <button className="btn btn-primary btn-sm" onClick={async () => {
                try {
                  await archiveApi.archive(confirmArchiveId);
                  addToast({ type: "success", title: "归档成功", message: "项目已归档" });
                  fetchProjects();
                } catch (e) {
                  addToast({ type: "error", title: "归档失败", message: String(e) });
                }
                setConfirmArchiveId(null);
              }}>归档</button>
            </>
          }
        >
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            归档后项目将从主列表移除，文件夹将被压缩为 zip 存储。可在归档库中恢复。
          </p>
        </Modal>
      )}
    </div>
  );
}

// ── 空状态 ──────────────────────────────────────────────────────

function EmptyState({ hasFilters, onCreateNew }: { hasFilters: boolean; onCreateNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full animate-fade-in" style={{ minHeight: 320 }}>
      <div className="empty-illustration">
        <FolderOpen size={40} strokeWidth={1.2} style={{ color: "var(--gold)" }} />
      </div>
      <h3 className="text-heading mt-5" style={{ color: "var(--text-primary)" }}>
        {hasFilters ? "没有匹配的项目" : "还没有项目"}
      </h3>
      <p className="text-caption mt-1.5 max-w-xs text-center" style={{ color: "var(--text-muted)" }}>
        {hasFilters
          ? "尝试调整筛选条件，或清除筛选查看全部项目"
          : "创建第一个项目，开始管理你的工作流程"}
      </p>
      {!hasFilters && (
        <button className="btn btn-primary mt-5" onClick={onCreateNew}>
          <Plus size={14} strokeWidth={1.5} />
          新建项目
        </button>
      )}
    </div>
  );
}

// ── 表格骨架屏 ─────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="p-4 animate-fade-in">
      {/* 表头骨架 */}
      <div className="flex items-center gap-4 pb-3 mb-2" style={{ borderBottom: "1px solid var(--border-light)" }}>
        <div className="skeleton" style={{ width: 16, height: 16 }} />
        <div className="skeleton" style={{ width: 80, height: 12 }} />
        <div className="skeleton" style={{ width: 160, height: 12 }} />
        <div className="skeleton" style={{ width: 80, height: 12 }} />
        <div className="skeleton" style={{ width: 60, height: 12 }} />
        <div className="skeleton" style={{ width: 80, height: 12, marginLeft: "auto" }} />
      </div>
      {/* 行骨架 */}
      {Array.from({ length: 8 }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 py-3"
          style={{ borderBottom: "1px solid var(--border-light)", animationDelay: `${i * 50}ms` }}
        >
          <div className="skeleton" style={{ width: 16, height: 16 }} />
          <div className="skeleton" style={{ width: 60 + Math.random() * 30, height: 12 }} />
          <div className="skeleton" style={{ width: 120 + Math.random() * 60, height: 12 }} />
          <div className="skeleton" style={{ width: 56, height: 22, borderRadius: "var(--radius-full)" }} />
          <div className="skeleton" style={{ width: 50 + Math.random() * 20, height: 12 }} />
          <div className="flex gap-1.5 ml-auto">
            <div className="skeleton" style={{ width: 24, height: 24, borderRadius: "var(--radius-sm)" }} />
            <div className="skeleton" style={{ width: 24, height: 24, borderRadius: "var(--radius-sm)" }} />
            <div className="skeleton" style={{ width: 24, height: 24, borderRadius: "var(--radius-sm)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 多选下拉 ──────────────────────────────────────────────────────

function MultiSelect({
  label,
  selected,
  items,
  onToggle,
  onClear,
}: {
  label: string;
  selected: string[];
  items: { id: string; name: string; color?: string }[];
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const count = selected.length;

  return (
    <div className="relative">
      <button
        className={`filter-chip ${count > 0 ? "active" : ""}`}
        onClick={() => setOpen(!open)}
      >
        {label}{count > 0 ? ` (${count})` : ""}
        <ChevronDown size={12} strokeWidth={1.5} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-full mt-1.5 z-50 p-1.5 min-w-[160px] animate-scale-in"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            {count > 0 && (
              <button
                className="w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors hover-gold-bg"
                style={{ color: "var(--gold)", border: "none", cursor: "pointer", background: "none" }}
                onClick={() => { onClear(); setOpen(false); }}
              >
                清除筛选
              </button>
            )}
            {items.map((item) => (
              <label
                key={item.id}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition-colors hover-surface-alt-bg"
                style={{ color: selected.includes(item.id) ? "var(--gold)" : "var(--text-secondary)" }}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(item.id)}
                  onChange={() => onToggle(item.id)}
                  className="w-3 h-3 accent-[var(--gold)]"
                />
                {item.color && (
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
                )}
                {item.name}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
