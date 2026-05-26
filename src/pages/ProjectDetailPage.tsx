import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Pencil, Clock, Calendar, FolderOpen } from "lucide-react";
import { useProjectStore } from "@/stores/useProjectStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { projectApi } from "@/lib/tauri-api";
import ProjectDialog from "@/components/project/ProjectDialog";
import FileExplorer from "@/components/files/FileExplorer";
import FilePanel from "@/components/files/FilePanel";
import Spinner from "@/components/common/Spinner";
import KanbanBoard from "@/components/kanban/KanbanBoard";
import GanttChart from "@/components/gantt/GanttChart";
import { formatDate, formatDateTime } from "@/lib/formatUtils";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = Number(id);
  const { currentProject, fetchProjectById, updateProject, loading } =
    useProjectStore();
  const { parsedStatuses, parsedTypes } = useSettingsStore();

  const [showEdit, setShowEdit] = useState(false);
  const tabParam = searchParams.get("tab");
  const initialTab = tabParam === "kanban" || tabParam === "gantt" ? tabParam : "detail";
  const [activeView, setActiveView] = useState<"detail" | "kanban" | "gantt">(initialTab);

  useEffect(() => {
    if (projectId && !isNaN(projectId)) fetchProjectById(projectId);
    return () => {
      // 仅组件卸载时清理，避免项目间切换时闪烁
    };
  }, [projectId, fetchProjectById]);

  // 响应 URL 中 tab 参数变化
  useEffect(() => {
    if (tabParam === "kanban" || tabParam === "gantt") {
      setActiveView(tabParam);
    }
  }, [tabParam]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

  if (!id || isNaN(projectId)) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          无效的项目 ID
        </span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => navigate("/projects")}
        >
          返回项目列表
        </button>
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          项目不存在
        </span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => navigate("/projects")}
        >
          返回项目列表
        </button>
      </div>
    );
  }

  const statusConfig = parsedStatuses.find((s) => s.id === currentProject.status);

  return (
    <div className="flex flex-col h-full animate-slide-up">
      {/* 页头 */}
      <div
        className="flex items-center gap-4 px-6 h-14 shrink-0 border-b"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border-light)",
        }}
      >
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-md transition-colors hover-gold-bg"
          style={{ color: "var(--text-secondary)" }}
          aria-label="返回"
        >
          <ArrowLeft size={16} strokeWidth={1.5} />
        </button>
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <h1
            className="text-title truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {currentProject.name}
          </h1>
          <button
            className="p-1 rounded-md transition-colors flex-shrink-0 hover-gold-bg"
            style={{ color: "var(--text-secondary)" }}
            aria-label="编辑项目"
            onClick={() => setShowEdit(true)}
          >
            <Pencil size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* 视图切换 Tab */}
      <div
        className="flex items-center gap-1 px-6 h-10 shrink-0"
        style={{ background: "var(--bg-surface)" }}
      >
        <div className="tab-group">
          {([
            { key: "detail", label: "项目详情" },
            { key: "kanban", label: "项目看板" },
            { key: "gantt", label: "项目甘特图" },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveView(tab.key)}
              className={`tab-item ${activeView === tab.key ? "active" : ""}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {currentProject?.folder_path && (
          <button
            className="ml-auto btn btn-outline btn-sm hover-gold-text"
            onClick={() => projectApi.openFolder(currentProject.folder_path!)}
            title={currentProject.folder_path}
          >
            <FolderOpen size={13} strokeWidth={1.5} />
            项目文件夹
          </button>
        )}
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-auto">
        {activeView === "detail" && (
          <div className="p-6 space-y-6">
        {/* 项目信息卡片 */}
        <div className="card">
          <h2
            className="text-lg mb-4"
            style={{ color: "var(--text-primary)" }}
          >
            项目信息
          </h2>

          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            {/* 项目名称 */}
            <InfoItem
              label="项目名称"
              value={currentProject.name}
            />
            {/* 项目编号 */}
            <InfoItem
              label="项目编号"
              value={currentProject.project_number || "—"}
            />
            {/* 项目分类 */}
            <InfoItem
              label="项目分类"
              value={parsedTypes.find(t => t.id === currentProject.project_type)?.name || currentProject.project_type || "—"}
            />
            {/* 项目状态 */}
            <div>
              <span
                className="text-[11px] block mb-0.5"
                style={{ color: "var(--text-muted)" }}
              >
                项目状态
              </span>
              <span
                className="badge inline-flex items-center gap-1.5"
                style={{
                  background: "var(--gold-glow)",
                  color: statusConfig?.color ?? "var(--text-secondary)",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full inline-block"
                  style={{ background: statusConfig?.color ?? "var(--text-muted)" }}
                />
                {(statusConfig?.name ?? currentProject.status) || "—"}
              </span>
            </div>
            {/* 开始日期 */}
            <InfoItem
              label="开始日期"
              value={formatDate(currentProject.start_date)}
              icon={<Calendar size={12} strokeWidth={1.5} />}
            />
            {/* 截止日期 */}
            <InfoItem
              label="截止日期"
              value={formatDate(currentProject.end_date)}
              icon={<Calendar size={12} strokeWidth={1.5} />}
            />
            {/* 状态变更时间 */}
            <InfoItem
              label="状态变更时间"
              value={formatDateTime(currentProject.status_changed_at)}
              icon={<Clock size={12} strokeWidth={1.5} />}
            />
            {/* 创建时间 */}
            <InfoItem
              label="创建时间"
              value={formatDateTime(currentProject.created_at)}
              icon={<Clock size={12} strokeWidth={1.5} />}
            />
            {/* 更新时间 */}
            <InfoItem
              label="更新时间"
              value={formatDateTime(currentProject.updated_at)}
              icon={<Clock size={12} strokeWidth={1.5} />}
            />
            {/* 创建人 */}
            <InfoItem
              label="创建人"
              value={currentProject.created_by || "—"}
            />
          </div>

          {/* 项目描述 */}
          {currentProject.description && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--border-light)" }}>
              <span
                className="text-[11px] block mb-1"
                style={{ color: "var(--text-muted)" }}
              >
                项目描述
              </span>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {currentProject.description}
              </p>
            </div>
          )}
        </div>

        {/* 文件列表 */}
        <div className="card">
          <h2
            className="text-lg mb-4 flex items-center gap-2"
            style={{ color: "var(--text-primary)" }}
          >
            <FolderOpen size={16} strokeWidth={1.5} />
            项目文件
          </h2>
          {currentProject?.folder_path
            ? <FileExplorer folderPath={currentProject.folder_path} />
            : <FilePanel projectId={projectId} />}
        </div>
          </div>
        )}
        {activeView === "kanban" && (
          <div className="p-6">
            <KanbanBoard projectId={projectId} />
          </div>
        )}
        {activeView === "gantt" && (
          <div className="p-6">
            <GanttChart projectId={projectId} />
          </div>
        )}
      </div>

      {showEdit && (
        <ProjectDialog
          title="编辑项目"
          project={currentProject}
          types={parsedTypes}
          statuses={parsedStatuses}
          onClose={() => setShowEdit(false)}
          onSubmit={async (data) => {
            await updateProject(projectId, data);
            setShowEdit(false);
          }}
        />
      )}
    </div>
  );
}

function InfoItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <span
        className="text-[11px] block mb-0.5"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
      <span
        className="text-sm flex items-center gap-1.5"
        style={{ color: "var(--text-primary)" }}
      >
        {icon}
        {value}
      </span>
    </div>
  );
}
