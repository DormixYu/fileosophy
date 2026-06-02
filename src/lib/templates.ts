import { settingsApi } from "./tauri-api";
import type { Project } from "@/types";

// ── 模板接口 ──────────────────────────────────────────────────

export interface ProjectTemplate {
  id: string;
  name: string;
  icon: string;
  prefix: string;
  defaultStatus: string;
  subfolders: string[];
  description: string;
  isDefault: boolean;
}

// ── 预设模板 ──────────────────────────────────────────────────

export const DEFAULT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "tb",
    name: "投标",
    icon: "📋",
    prefix: "TB",
    defaultStatus: "planning",
    subfolders: ["01-投标文件", "02-报价", "03-合同"],
    description: "投标、招标相关项目",
    isDefault: true,
  },
  {
    id: "pj",
    name: "项目",
    icon: "📁",
    prefix: "PJ",
    defaultStatus: "in_progress",
    subfolders: ["01-项目文件", "02-会议记录", "03-交付物"],
    description: "常规项目管理",
    isDefault: true,
  },
  {
    id: "xz",
    name: "行政",
    icon: "🏛️",
    prefix: "XZ",
    defaultStatus: "in_progress",
    subfolders: ["01-通知", "02-制度", "03-报告"],
    description: "行政事务管理",
    isDefault: true,
  },
  {
    id: "st",
    name: "学习",
    icon: "📚",
    prefix: "ST",
    defaultStatus: "in_progress",
    subfolders: ["01-笔记", "02-资料", "03-作业"],
    description: "学习计划与资料",
    isDefault: true,
  },
  {
    id: "qt",
    name: "其他",
    icon: "📎",
    prefix: "QT",
    defaultStatus: "planning",
    subfolders: ["01-文件"],
    description: "其他类型项目",
    isDefault: true,
  },
];

const TEMPLATES_KEY = "project_templates";

// ── 工具函数 ──────────────────────────────────────────────────

/** 从 settings 表读取模板列表，首次读取时自动初始化预设模板 */
export async function getTemplates(): Promise<ProjectTemplate[]> {
  try {
    const settings = await settingsApi.get();
    const raw = settings[TEMPLATES_KEY];
    if (raw) {
      return JSON.parse(raw) as ProjectTemplate[];
    }
  } catch {
    // ignore
  }
  // 首次读取，保存默认模板
  await saveTemplates(DEFAULT_TEMPLATES);
  return DEFAULT_TEMPLATES;
}

/** 保存模板列表到 settings 表 */
export async function saveTemplates(templates: ProjectTemplate[]): Promise<void> {
  const settings = await settingsApi.get();
  await settingsApi.update({
    ...settings,
    [TEMPLATES_KEY]: JSON.stringify(templates),
  });
}

/** 根据模板前缀和已有项目列表，生成下一个项目编号 */
export function getNextProjectNumber(
  prefix: string,
  projects: Project[],
): string {
  const today = new Date();
  const yy = String(today.getFullYear()).slice(-2);
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const dateStr = `${yy}${mm}${dd}`;

  // 计算当日同前缀的项目数量
  const pattern = `${prefix}-${dateStr}`;
  const count = projects.filter(
    (p) => p.project_number && p.project_number.startsWith(pattern),
  ).length;

  return `${prefix}-${dateStr}-${String(count + 1).padStart(2, "0")}`;
}
