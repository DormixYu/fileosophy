import { Link } from "react-router-dom";
import { Pencil, Trash2, Calendar, Hash, Archive } from "lucide-react";
import { formatDate } from "@/lib/formatUtils";
import type { Project, ProjectStatusConfig, ProjectTypeConfig } from "@/types";

export default function ProjectCard({
  project,
  statuses,
  types,
  onEdit,
  onDelete,
  onArchive,
}: {
  project: Project;
  statuses: ProjectStatusConfig[];
  types: ProjectTypeConfig[];
  onEdit: (p: Project) => void;
  onDelete: (e: React.MouseEvent, id: number) => void;
  onArchive: (e: React.MouseEvent, id: number) => void;
}) {
  const statusConfig = statuses.find((s) => s.id === project.status);
  const typeName = types.find((t) => t.id === project.project_type)?.name;

  return (
    <div
      className="project-card group"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding: "1rem 1.25rem",
        transition: "all var(--duration-base) var(--ease-liquid)",
        cursor: "pointer",
      }}
    >
      {/* 头部：名称 + 操作 */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <Link
          to={`/project/${project.id}`}
          className="text-sm font-medium hover:underline line-clamp-2 leading-snug"
          style={{ color: "var(--text-primary)" }}
        >
          {project.name}
        </Link>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(project);
            }}
            className="p-1 rounded transition-colors hover-surface-alt-bg hover-gold-text"
            style={{ color: "var(--text-muted)", cursor: "pointer", background: "none", border: "none" }}
            title="编辑项目"
          >
            <Pencil size={12} strokeWidth={1.5} />
          </button>
          <button
            onClick={(e) => onDelete(e, project.id)}
            className="p-1 rounded transition-colors hover-danger-text"
            style={{ color: "var(--text-muted)", cursor: "pointer", background: "none", border: "none" }}
            title="删除项目"
          >
            <Trash2 size={12} strokeWidth={1.5} />
          </button>
          <button
            onClick={(e) => onArchive(e, project.id)}
            className="p-1 rounded transition-colors hover-gold-text"
            style={{ color: "var(--text-muted)", cursor: "pointer", background: "none", border: "none" }}
            title="归档项目"
          >
            <Archive size={12} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* 编号 */}
      {project.project_number && (
        <div className="flex items-center gap-1.5 mb-2">
          <Hash size={11} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            {project.project_number}
          </span>
        </div>
      )}

      {/* 标签行 */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        {/* 状态标签 */}
        {statusConfig && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 text-micro"
            style={{
              background: `${statusConfig.color}12`,
              color: statusConfig.color,
              borderRadius: "var(--radius-full)",
              fontWeight: 500,
              border: `1px solid ${statusConfig.color}20`,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full inline-block shrink-0"
              style={{ background: statusConfig.color }}
            />
            {statusConfig.name}
          </span>
        )}
        {/* 分类标签 */}
        {typeName && (
          <span
            className="inline-flex items-center px-2 py-0.5 text-micro"
            style={{
              background: "var(--bg-surface-alt)",
              color: "var(--text-tertiary)",
              borderRadius: "var(--radius-full)",
              border: "1px solid var(--border-light)",
            }}
          >
            {typeName}
          </span>
        )}
      </div>

      {/* 底部：日期 */}
      <div className="flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
        <Calendar size={11} strokeWidth={1.5} />
        <span className="text-micro">{formatDate(project.created_at)}</span>
      </div>
    </div>
  );
}
