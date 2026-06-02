import { useState, useEffect } from "react";
import Modal from "@/components/common/Modal";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { getToday } from "@/lib/ganttUtils";
import DatePicker from "@/components/common/DatePicker";
import { projectApi } from "@/lib/tauri-api";
import {
  getTemplates,
  getNextProjectNumber,
  type ProjectTemplate,
} from "@/lib/templates";
import type { Project, ProjectStatus, ProjectStatusConfig, ProjectTypeConfig } from "@/types";

// ── 新建模式：模板选择 + 名称输入 ─────────────────────────────

export interface ProjectDialogProps {
  title: string;
  project?: Project;
  types: ProjectTypeConfig[];
  statuses: ProjectStatusConfig[];
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description?: string;
    project_type?: string;
    status?: ProjectStatus;
    start_date?: string;
    end_date?: string;
    parent_path?: string;
  }) => Promise<void>;
}

// ── 模板图标映射 ──────────────────────────────────────────────

function TemplateIcon({ icon, selected }: { icon: string; selected: boolean }) {
  return (
    <div
      className="flex items-center justify-center w-10 h-10 rounded-lg text-xl transition-all"
      style={{
        background: selected ? "var(--gold-bg)" : "var(--bg-elevated)",
      }}
    >
      {icon}
    </div>
  );
}

// ── Step 1: 选择模板 ──────────────────────────────────────────

function TemplateStep({
  templates,
  selected,
  onSelect,
}: {
  templates: ProjectTemplate[];
  selected: ProjectTemplate | null;
  onSelect: (t: ProjectTemplate) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        选择项目类型
      </p>
      <div className="grid grid-cols-1 gap-2">
        {templates.map((t) => {
          const isSelected = selected?.id === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t)}
              className="flex items-center gap-3 p-3 rounded-lg text-left transition-all w-full"
              style={{
                background: isSelected ? "var(--gold-bg)" : "var(--bg-elevated)",
                border: `1.5px solid ${isSelected ? "var(--gold)" : "var(--border-default)"}`,
                boxShadow: isSelected ? "var(--shadow-gold)" : "none",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = "var(--gold-light)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "var(--shadow-md)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = "var(--border-default)";
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "none";
                }
              }}
            >
              <TemplateIcon icon={t.icon} selected={isSelected} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {t.name}
                  <span
                    className="ml-2 text-xs font-mono"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {t.prefix}-xxx
                  </span>
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {t.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 2: 输入项目名称 ──────────────────────────────────────

function NameStep({
  template,
  projectNumber,
  name,
  onNameChange,
}: {
  template: ProjectTemplate;
  projectNumber: string;
  name: string;
  onNameChange: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg"
        style={{ background: "var(--bg-elevated)" }}
      >
        <span className="text-base">{template.icon}</span>
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {template.name}
        </span>
        <span
          className="ml-auto text-xs font-mono"
          style={{ color: "var(--text-muted)" }}
        >
          {projectNumber}
        </span>
      </div>

      <div>
        <label className="form-label">项目名称</label>
        <input
          type="text"
          placeholder="输入项目名称"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          autoFocus
          className="form-input"
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) {
              // 触发父组件的提交
              e.currentTarget.closest("form")?.dispatchEvent(
                new Event("submit", { bubbles: true, cancelable: true })
              );
            }
          }}
        />
      </div>
    </div>
  );
}

// ── 编辑模式（保留原有功能）───────────────────────────────────

function EditForm({
  project,
  types,
  statuses,
  name,
  setName,
  description,
  setDescription,
  projectType,
  setProjectType,
  status,
  setStatus,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}: {
  project: Project;
  types: ProjectTypeConfig[];
  statuses: ProjectStatusConfig[];
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  projectType: string;
  setProjectType: (v: string) => void;
  status: ProjectStatus;
  setStatus: (v: ProjectStatus) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="mb-4 text-micro tracking-wider" style={{ color: "var(--text-muted)" }}>
        编号：{project.project_number || "—"}
      </div>

      <div>
        <label className="form-label">项目名称</label>
        <input
          type="text"
          placeholder="输入项目名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          className="form-input"
        />
      </div>

      <div>
        <label className="form-label">项目描述</label>
        <textarea
          placeholder="简要描述项目内容（可选）"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="form-input resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label">项目分类</label>
          <select
            value={projectType}
            onChange={(e) => setProjectType(e.target.value)}
            className="form-input"
          >
            <option value="">未选择</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">项目状态</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ProjectStatus)}
            className="form-input"
          >
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label">开始日期</label>
          <DatePicker
            value={startDate}
            onChange={setStartDate}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
            }}
          />
        </div>
        <div>
          <label className="form-label">截止日期</label>
          <DatePicker
            value={endDate}
            onChange={setEndDate}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ── 主组件 ────────────────────────────────────────────────────

export default function ProjectDialog({
  title,
  project,
  types,
  statuses,
  onClose,
  onSubmit,
}: ProjectDialogProps) {
  const { settings } = useSettingsStore();
  const isEdit = !!project;

  // ── 模板相关状态（新建模式）──
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [projects, setProjects] = useState<Project[]>([]);

  // ── 编辑模式 + 通用状态 ──
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [projectType, setProjectType] = useState(project?.project_type ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "planning");
  const [startDate, setStartDate] = useState(project?.start_date?.slice(0, 10) ?? getToday());
  const [endDate, setEndDate] = useState(project?.end_date?.slice(0, 10) ?? "");
  const [saving, setSaving] = useState(false);

  // 加载模板和项目列表（仅新建模式）
  useEffect(() => {
    if (isEdit) return;
    getTemplates().then(setTemplates);
    projectApi.getAll().then(setProjects).catch(() => {});
  }, [isEdit]);

  // 自动生成编号
  const projectNumber = selectedTemplate
    ? getNextProjectNumber(selectedTemplate.prefix, projects)
    : "";

  const handleTemplateSelect = (t: ProjectTemplate) => {
    setSelectedTemplate(t);
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
    setSelectedTemplate(null);
    setName("");
  };

  const handleCreateSubmit = async () => {
    if (!selectedTemplate || !name.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        project_type: selectedTemplate.id,
        status: selectedTemplate.defaultStatus as ProjectStatus,
        start_date: getToday(),
        parent_path: settings["default_project_path"] || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        project_type: projectType || undefined,
        status: status || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  // ── 新建模式 ──────────────────────────────────────────────

  if (!isEdit) {
    return (
      <Modal
        open={true}
        onClose={onClose}
        title={step === 1 ? "新建项目" : `${selectedTemplate?.icon} ${selectedTemplate?.name}`}
        width="max-w-[440px]"
        footer={
          step === 1 ? (
            <button className="btn btn-ghost" onClick={onClose}>
              取消
            </button>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={handleBack}>
                返回
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateSubmit}
                disabled={!name.trim() || saving}
              >
                {saving ? "创建中..." : "创建"}
              </button>
            </>
          )
        }
      >
        {step === 1 ? (
          <TemplateStep
            templates={templates}
            selected={selectedTemplate}
            onSelect={handleTemplateSelect}
          />
        ) : selectedTemplate ? (
          <NameStep
            template={selectedTemplate}
            projectNumber={projectNumber}
            name={name}
            onNameChange={setName}
          />
        ) : null}
      </Modal>
    );
  }

  // ── 编辑模式 ──────────────────────────────────────────────

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={title}
      width="max-w-[480px]"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            取消
          </button>
          <button
            className="btn btn-primary"
            onClick={handleEditSubmit}
            disabled={!name.trim() || saving}
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </>
      }
    >
      <EditForm
        project={project}
        types={types}
        statuses={statuses}
        name={name}
        setName={setName}
        description={description}
        setDescription={setDescription}
        projectType={projectType}
        setProjectType={setProjectType}
        status={status}
        setStatus={setStatus}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
      />
    </Modal>
  );
}
