import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Pencil, Clock, Calendar, FolderOpen, BookMarked } from "lucide-react";
import { useProjectStore } from "@/stores/useProjectStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { projectApi } from "@/lib/tauri-api";
import ProjectDialog from "@/components/project/ProjectDialog";
import FileExplorer from "@/components/files/FileExplorer";
import FilePanel from "@/components/files/FilePanel";
import Spinner from "@/components/common/Spinner";
import KanbanBoard from "@/components/kanban/KanbanBoard";
import GanttChart from "@/components/gantt/GanttChart";
import WorkSessionPanel from "@/components/sessions/WorkSessionPanel";
import { formatDate, formatDateTime } from "@/lib/formatUtils";
import type { WorkSession } from "@/types";

type TabKey = "files" | "kanban" | "gantt" | "sessions";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = Number(id);
  const { currentProject, fetchProjectById, updateProject, loading } =
    useProjectStore();
  const { parsedStatuses, parsedTypes } = useSettingsStore();

  const [showEdit, setShowEdit] = useState(false);
  const [activeKanbanCardId, setActiveKanbanCardId] = useState<number | null>(null);
  const [openFiles, setOpenFiles] = useState<string[]>([]);

  const tabParam = searchParams.get("tab");
  const resolveTab = (t: string | null): TabKey => {
    if (t === "kanban" || t === "gantt" || t === "sessions") return t;
    return "files";
  };
  const [activeTab, setActiveTab] = useState<TabKey>(resolveTab(tabParam));

  useEffect(() => {
    if (projectId && !isNaN(projectId)) fetchProjectById(projectId);
  }, [projectId, fetchProjectById]);

  useEffect(() => {
    setActiveTab(resolveTab(tabParam));
  }, [tabParam]);

  // 恢复工作会话
  const handleRestoreSession = (session: WorkSession) => {
    try {
      const parsed = JSON.parse(session.open_files);
      if (Array.isArray(parsed)) setOpenFiles(parsed);
    } catch {
      /* ignore */
    }
    setActiveTab(session.active_tab as TabKey);
    if (session.active_kanban_card_id) {
      setActiveKanbanCardId(session.active_kanban_card_id);
    }
  };

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
        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/projects")}>
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
        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/projects")}>
          返回项目列表
        </button>
      </div>
    );
  }

  const statusConfig = parsedStatuses.find((s) => s.id === currentProject.status);

  return (
    <div className="flex flex-col h-full animate-slide-up">
      {/* 顶部信息栏 */}
      <div
        className="flex items-center gap-4 px-6 h-14 shrink-0 border-b"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border-light)" }}
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
          <h1 className="text-title truncate" style={{ color: "var(--text-primary)" }}>
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
          {currentProject.project_number && (
            <span className="badge shrink-0" style={{ fontSize: "10px" }}>
              {currentProject.project_number}
            </span>
          )}
          {currentProject.project_type && (
            <span className="badge shrink-0" style={{ fontSize: "10px" }}>
              {parsedTypes.find((t) => t.id === currentProject.project_type)?.name ||
                currentProject.project_type}
            </span>
          )}
          {statusConfig && (
            <span
              className="badge inline-flex items-center gap-1.5 shrink-0"
              style={{
                background: "var(--gold-glow)",
                color: statusConfig.color ?? "var(--text-secondary)",
                fontSize: "10px",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{ background: statusConfig.color ?? "var(--text-muted)" }}
              />
              {statusConfig.name ?? currentProject.status}
            </span>
          )}
        </div>
      </div>

      {/* 标签页 */}
      <div
        className="flex items-center gap-1 px-6 h-10 shrink-0"
        style={{ background: "var(--bg-surface)" }}
      >
        <div className="tab-group">
          {([
            { key: "files" as TabKey, label: "文件管理" },
            { key: "kanban" as TabKey, label: "看板" },
            { key: "gantt" as TabKey, label: "甘特图" },
            { key: "sessions" as TabKey, label: "工作会话" },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`tab-item ${activeTab === tab.key ? "active" : ""}`}
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
        {activeTab === "files" && (
          <div className="p-6 space-y-6">
            {/* 项目信息摘要（可折叠） */}
            <ProjectInfoSummary
              project={currentProject}
              statusConfig={statusConfig}
              parsedTypes={parsedTypes}
            />

            {/* 文件管理 */}
            <div className="card">
              {currentProject?.folder_path ? (
                <FileExplorer folderPath={currentProject.folder_path} />
              ) : (
                <FilePanel projectId={projectId} />
              )}
            </div>
          </div>
        )}
        {activeTab === "kanban" && (
          <div className="p-6 h-full">
            <KanbanBoard projectId={projectId} />
          </div>
        )}
        {activeTab === "gantt" && (
          <div className="p-6">
            <GanttChart projectId={projectId} />
          </div>
        )}
        {activeTab === "sessions" && (
          <div className="p-6">
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <BookMarked size={15} strokeWidth={1.5} style={{ color: "var(--gold)" }} />
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  工作会话
                </span>
              </div>
              <WorkSessionPanel
                projectId={projectId}
                activeTab={activeTab === "sessions" ? "files" : activeTab}
                activeKanbanCardId={activeKanbanCardId}
                openFiles={openFiles}
                onRestore={handleRestoreSession}
              />
            </div>
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

/** 项目信息摘要（文件管理标签页内显示） */
function ProjectInfoSummary({
  project,
  statusConfig,
  parsedTypes,
}: {
  project: import("@/types").Project;
  statusConfig?: import("@/types").ProjectStatusConfig;
  parsedTypes: import("@/types").ProjectTypeConfig[];
}) {
  return (
    <div className="card">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2">
        <MiniInfo label="编号" value={project.project_number || "—"} />
        <MiniInfo
          label="分类"
          value={
            parsedTypes.find((t) => t.id === project.project_type)?.name ||
            project.project_type ||
            "—"
          }
        />
        <MiniInfo
          label="状态"
          value={statusConfig?.name ?? project.status ?? "—"}
          color={statusConfig?.color}
        />
        <MiniInfo label="创建人" value={project.created_by || "—"} />
        <MiniInfo
          label="开始"
          value={formatDate(project.start_date)}
          icon={<Calendar size={11} strokeWidth={1.5} />}
        />
        <MiniInfo
          label="截止"
          value={formatDate(project.end_date)}
          icon={<Calendar size={11} strokeWidth={1.5} />}
        />
        <MiniInfo
          label="创建时间"
          value={formatDateTime(project.created_at)}
          icon={<Clock size={11} strokeWidth={1.5} />}
        />
        <MiniInfo
          label="更新时间"
          value={formatDateTime(project.updated_at)}
          icon={<Clock size={11} strokeWidth={1.5} />}
        />
      </div>
      {project.description && (
        <p
          className="mt-2 text-xs leading-relaxed truncate"
          style={{ color: "var(--text-muted)" }}
          title={project.description}
        >
          {project.description}
        </p>
      )}
    </div>
  );
}

function MiniInfo({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>
        {label}:
      </span>
      <span
        className="text-xs truncate flex items-center gap-1"
        style={{ color: color || "var(--text-primary)" }}
      >
        {icon}
        {value}
      </span>
    </div>
  );
}
