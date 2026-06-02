import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Archive,
} from "lucide-react";
import { formatDate } from "@/lib/formatUtils";
import InCellStatusDropdown from "./InCellStatusDropdown";
import type {
  Project,
  ProjectStatus,
  ProjectStatusConfig,
  ProjectTypeConfig,
  ProjectTableColumn,
} from "@/types";

export type SortDir = "asc" | "desc" | null;

export interface SortState {
  key: string;
  dir: SortDir;
}

const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 38;

// ── 单元格内容渲染 ─────────────────────────────────────────────

function CellContent({
  column,
  project,
  statuses,
  types,
  getStatusConfig,
  onStatusChange,
}: {
  column: ProjectTableColumn;
  project: Project;
  statuses: ProjectStatusConfig[];
  types: ProjectTypeConfig[];
  getStatusConfig: (id: string | null) => ProjectStatusConfig | undefined;
  onStatusChange?: (projectId: number, newStatus: ProjectStatus) => void;
}) {
  const value = (project as unknown as Record<string, unknown>)[column.key];

  switch (column.key) {
    case "project_number":
      return (
        <span className="text-caption" style={{ color: "var(--text-tertiary)" }}>
          {String(value || "—")}
        </span>
      );

    case "name":
      return (
        <Link
          to={`/project/${project.id}`}
          className="hover:underline"
          style={{ color: "var(--text-primary)", fontWeight: 500 }}
        >
          {String(value)}
        </Link>
      );

    case "status": {
      return (
        <InCellStatusDropdown
          project={project}
          statuses={statuses}
          getStatusConfig={getStatusConfig}
          onStatusChange={onStatusChange}
        />
      );
    }

    case "project_type": {
      const typeName = types.find(t => t.id === String(value))?.name;
      return (
        <span style={{ color: value ? "var(--text-secondary)" : "var(--text-muted)" }}>
          {typeName || String(value || "—")}
        </span>
      );
    }

    case "start_date":
    case "end_date":
    case "created_at":
    case "updated_at":
    case "status_changed_at":
      return (
        <span className="text-caption" style={{ color: "var(--text-tertiary)" }}>
          {formatDate(String(value || ""))}
        </span>
      );

    case "created_by":
      return (
        <span style={{ color: value ? "var(--text-secondary)" : "var(--text-muted)" }}>
          {String(value || "—")}
        </span>
      );

    default:
      return (
        <span style={{ color: "var(--text-secondary)" }}>
          {String(value ?? "—")}
        </span>
      );
  }
}

// ── 表格组件 ──────────────────────────────────────────────────

export default function ProjectTable({
  filtered,
  visibleColumns,
  sort,
  selectedIds,
  selectAllRef,
  handleSort,
  handleSelectAll,
  handleToggleSelect,
  handleDoubleClick,
  handleStatusChange,
  setEditProject,
  handleDelete,
  handleArchive,
  statuses,
  types,
  onColumnResizeLive,
  onColumnResizeEnd,
}: {
  filtered: Project[];
  visibleColumns: ProjectTableColumn[];
  sort: SortState;
  selectedIds: Set<number>;
  selectAllRef: React.RefObject<HTMLInputElement>;
  handleSort: (key: string) => void;
  handleSelectAll: () => void;
  handleToggleSelect: (id: number) => void;
  handleDoubleClick: (project: Project) => void;
  handleStatusChange: (projectId: number, newStatus: ProjectStatus) => void;
  setEditProject: (p: Project) => void;
  handleDelete: (e: React.MouseEvent, id: number) => void;
  handleArchive: (e: React.MouseEvent, id: number) => void;
  statuses: ProjectStatusConfig[];
  types: ProjectTypeConfig[];
  onColumnResizeLive: (colKey: string, newWidth: number) => void;
  onColumnResizeEnd: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fillRows, setFillRows] = useState(0);

  // 拖拽调宽状态（用 ref 避免 useEffect 重建）
  const resizingRef = useRef<{ colKey: string; startX: number; startWidth: number } | null>(null);
  const [resizingKey, setResizingKey] = useState<string | null>(null); // 仅用于视觉指示

  const getStatusConfig = useCallback(
    (statusId?: string | null) => statuses.find((s) => s.id === statusId),
    [statuses]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const calc = () => {
      const h = el.clientHeight;
      const available = Math.max(0, Math.floor((h - HEADER_HEIGHT) / ROW_HEIGHT));
      setFillRows(Math.max(0, available - filtered.length));
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [filtered.length]);

  const handleResizeStart = (colKey: string, currentWidth: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = { colKey, startX: e.clientX, startWidth: currentWidth };
    setResizingKey(colKey);

    const handleMouseMove = (ev: MouseEvent) => {
      const r = resizingRef.current;
      if (!r) return;
      const delta = ev.clientX - r.startX;
      onColumnResizeLive(r.colKey, r.startWidth + delta);
    };

    const handleMouseUp = () => {
      resizingRef.current = null;
      setResizingKey(null);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      onColumnResizeEnd();
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div ref={containerRef} className="h-full overflow-auto">
      <table className="w-full text-xs" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
        <thead>
          <tr>
            <th
              className="px-3 py-2.5 select-none"
              style={{
                width: 36,
                borderBottom: "1px solid var(--border-default)",
                background: "var(--bg-surface-alt)",
                position: "sticky",
                top: 0,
                zIndex: 2,
              }}
            >
              <input
                type="checkbox"
                ref={selectAllRef}
                checked={filtered.length > 0 && selectedIds.size === filtered.length}
                onChange={handleSelectAll}
                className="accent-[var(--gold)]"
              />
            </th>
            {visibleColumns.map((col, i) => (
              <th
                key={col.key}
                className="text-left px-3 py-2.5 select-none relative"
                style={{
                  width: col.key === "name" ? undefined : col.width,
                  minWidth: col.key === "name" ? 120 : 40,
                  cursor: col.sortable ? "pointer" : "default",
                  borderBottom: "1px solid var(--border-default)",
                  background: "var(--bg-surface-alt)",
                  letterSpacing: "0.04em",
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "var(--text-muted)",
                  userSelect: resizingKey ? "none" : "auto",
                  position: "sticky",
                  top: 0,
                  zIndex: 2,
                }}
                onClick={() => {
                  if (resizingKey) return;
                  if (col.sortable) handleSort(col.key);
                }}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {col.sortable && sort.key === col.key && (
                    <span style={{ color: "var(--gold)" }}>
                      {sort.dir === "asc" ? (
                        <ArrowUp size={11} strokeWidth={2} />
                      ) : (
                        <ArrowDown size={11} strokeWidth={2} />
                      )}
                    </span>
                  )}
                </span>

                {/* 列宽拖拽把手（右侧） */}
                {i < visibleColumns.length - 1 && (
                  <div
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize transition-colors"
                    style={{
                      opacity: resizingKey === col.key ? 1 : 0,
                      background: "var(--gold)",
                    }}
                    onMouseDown={(e) => handleResizeStart(col.key, col.width, e)}
                  />
                )}
              </th>
            ))}
            <th
              className="text-right px-3 py-2.5"
              style={{
                width: 80,
                borderBottom: "1px solid var(--border-default)",
                background: "var(--bg-surface-alt)",
                fontSize: "11px",
                fontWeight: 500,
                color: "var(--text-muted)",
                letterSpacing: "0.04em",
                position: "sticky",
                top: 0,
                zIndex: 2,
              }}
            >
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((project, rowIndex) => (
            <tr
              key={project.id}
              className="group table-row-enter"
              style={{
                borderBottom: "1px solid var(--border-light)",
                animationDelay: `${rowIndex * 30}ms`,
              }}
              onDoubleClick={() => handleDoubleClick(project)}
            >
              <td
                className="px-3 py-2"
                style={{ borderBottom: "1px solid var(--border-light)" }}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(project.id)}
                  onChange={() => handleToggleSelect(project.id)}
                  className="accent-[var(--gold)]"
                />
              </td>
              {visibleColumns.map((col) => (
                <td
                  key={col.key}
                  className={`px-3 py-2 ${col.key === "name" ? "" : "whitespace-nowrap"}`}
                  style={{
                    color: "var(--text-primary)",
                    borderBottom: "1px solid var(--border-light)",
                  }}
                >
                  <CellContent
                    column={col}
                    project={project}
                    statuses={statuses}
                    types={types}
                    getStatusConfig={getStatusConfig}
                    onStatusChange={handleStatusChange}
                  />
                </td>
              ))}
              <td
                className="px-3 py-2 text-right"
                style={{ borderBottom: "1px solid var(--border-light)" }}
              >
                <div className="flex items-center justify-end gap-0.5 row-actions">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditProject(project);
                    }}
                    className="p-1 rounded transition-colors hover-surface-alt-bg hover-gold-text"
                    style={{ color: "var(--text-muted)", cursor: "pointer", background: "none", border: "none" }}
                    title="编辑项目"
                    aria-label="编辑项目"
                  >
                    <Pencil size={13} strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, project.id)}
                    className="p-1 rounded transition-colors hover-danger-text"
                    style={{ color: "var(--text-muted)", cursor: "pointer", background: "none", border: "none" }}
                    title="删除项目"
                    aria-label="删除项目"
                  >
                    <Trash2 size={13} strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={(e) => handleArchive(e, project.id)}
                    className="p-1 rounded transition-colors hover-gold-text"
                    style={{ color: "var(--text-muted)", cursor: "pointer", background: "none", border: "none" }}
                    title="归档项目"
                    aria-label="归档项目"
                  >
                    <Archive size={13} strokeWidth={1.5} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {fillRows > 0 &&
            Array.from({ length: fillRows }, (_, i) => (
              <tr
                key={`_empty_${i}`}
                style={{ height: ROW_HEIGHT }}
              >
                <td colSpan={visibleColumns.length + 2} style={{ borderBottom: "1px solid var(--border-light)" }} />
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
