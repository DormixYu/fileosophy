import { useState } from "react";
import { Download, Upload, FileJson, FileSpreadsheet, AlertTriangle } from "lucide-react";
import { useNotificationStore } from "@/stores/useNotificationStore";
import { projectApi, exportApi } from "@/lib/tauri-api";
import Modal from "@/components/common/Modal";
import FolderScanImport from "@/components/settings/FolderScanImport";

export default function DataSection() {
  const { addToast } = useNotificationStore();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showExportPicker, setShowExportPicker] = useState(false);
  const [exportFormat, setExportFormat] = useState<"json" | "csv">("json");
  const [exportProjects, setExportProjects] = useState<{ id: number; name: string }[]>([]);
  const [exportIncludeFiles, setExportIncludeFiles] = useState(false);
  const [showImportMode, setShowImportMode] = useState(false);
  const [importFilePath, setImportFilePath] = useState<string>("");
  const [importReplace, setImportReplace] = useState(false);

  const handleExportAll = async () => {
    setExporting(true);
    try {
      const json = await exportApi.exportAllProjects(exportIncludeFiles);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fileosophy-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addToast({ type: "success", title: "备份完成", message: "所有项目数据已导出" });
    } catch (e) {
      addToast({ type: "error", title: "备份失败", message: String(e) });
    } finally {
      setExporting(false);
    }
  };

  const handleImportAll = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!selected) return;
      setImportFilePath(selected as string);
      setShowImportMode(true);
    } catch (e) {
      addToast({ type: "error", title: "选择文件失败", message: String(e) });
    }
  };

  const handleImportConfirm = async () => {
    setShowImportMode(false);
    setImporting(true);
    try {
      const projects = await exportApi.importAllProjects(importFilePath, importReplace);
      addToast({ type: "success", title: "导入完成", message: `成功导入 ${projects.length} 个项目` });
    } catch (e) {
      addToast({ type: "error", title: "导入失败", message: String(e) });
    } finally {
      setImporting(false);
      setImportFilePath("");
      setImportReplace(false);
    }
  };

  const handleExportSingle = async (format: "json" | "csv") => {
    try {
      const allProjects = await projectApi.getAll();
      const projects = allProjects.map(p => ({ id: p.id, name: p.name }));
      if (projects.length === 0) {
        addToast({ type: "warning", title: "没有项目", message: "请先创建一个项目" });
        return;
      }
      setExportProjects(projects);
      setExportFormat(format);
      setShowExportPicker(true);
    } catch (e) {
      addToast({ type: "error", title: "导出失败", message: String(e) });
    }
  };

  const handleExportConfirm = async (projectId: number) => {
    try {
      setShowExportPicker(false);
      const result = await exportApi.exportProject(projectId, exportFormat, exportIncludeFiles);
      const ext = exportFormat === "json" ? "json" : "csv";
      const mimeType = exportFormat === "json" ? "application/json" : "text/csv";
      const blob = new Blob([result], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `project-${projectId}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      addToast({ type: "success", title: "导出完成", message: `项目已导出为 ${exportFormat.toUpperCase()} 格式` });
    } catch (e) {
      addToast({ type: "error", title: "导出失败", message: String(e) });
    }
  };

  return (
    <section className="animate-slide-up">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-title font-serif" style={{ color: "var(--text-primary)" }}>
          数据管理
        </h2>
        <div className="w-8 h-[2px] rounded-full" style={{ background: "var(--gold)", opacity: 0.5 }} />
      </div>

      {/* 导出选项 */}
      <div className="mb-4">
        <label className="flex items-center gap-2 cursor-pointer" style={{ color: "var(--text-secondary)" }}>
          <input
            type="checkbox"
            checked={exportIncludeFiles}
            onChange={(e) => setExportIncludeFiles(e.target.checked)}
            className="rounded"
          />
          <span className="text-xs">导出时包含文件内容（体积较大）</span>
        </label>
      </div>

      {/* 备份与还原 */}
      <div className="mb-6">
        <h3 className="text-sm font-serif mb-3" style={{ color: "var(--text-secondary)" }}>
          完整备份与还原
        </h3>
        <p className="text-xs mb-3 font-mono" style={{ color: "var(--text-tertiary)" }}>
          导出所有项目数据（含看板、甘特图、文件元数据）为 JSON 格式，可用于完整备份和迁移。
        </p>
        <div className="flex gap-3">
          <button className="btn btn-outline" onClick={handleExportAll} disabled={exporting}>
            <Download size={14} strokeWidth={1.5} />
            {exporting ? "导出中..." : "导出全部项目"}
          </button>
          <button className="btn btn-primary" onClick={handleImportAll} disabled={importing}>
            <Upload size={14} strokeWidth={1.5} />
            {importing ? "导入中..." : "从备份文件导入"}
          </button>
        </div>
      </div>

      {/* 单项目导出 */}
      <div>
        <h3 className="text-sm font-serif mb-3" style={{ color: "var(--text-secondary)" }}>
          单项目导出
        </h3>
        <p className="text-xs mb-3 font-mono" style={{ color: "var(--text-tertiary)" }}>
          将当前选中的项目导出为不同格式。
        </p>
        <div className="flex gap-3">
          <button className="btn btn-outline btn-sm" onClick={() => handleExportSingle("json")}>
            <FileJson size={13} strokeWidth={1.5} />
            导出 JSON
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => handleExportSingle("csv")}>
            <FileSpreadsheet size={13} strokeWidth={1.5} />
            导出 CSV
          </button>
        </div>
      </div>

      {/* 文件夹扫描导入 */}
      <FolderScanImport addToast={addToast} />

      {/* 项目选择弹窗 */}
      <Modal
        open={showExportPicker}
        onClose={() => setShowExportPicker(false)}
        title="选择导出项目"
        footer={
          <button className="btn btn-ghost btn-sm" onClick={() => setShowExportPicker(false)}>
            取消
          </button>
        }
      >
        <div className="space-y-1 max-h-60 overflow-auto">
          {exportProjects.map((p) => (
            <button
              key={p.id}
              className="w-full text-left px-3 py-2 rounded-md text-sm font-serif transition-colors hover-gold-bg"
              style={{ color: "var(--text-primary)" }}
              onClick={() => handleExportConfirm(p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>
      </Modal>

      {/* 导入模式选择弹窗 */}
      <Modal
        open={showImportMode}
        onClose={() => { setShowImportMode(false); setImportFilePath(""); }}
        title="选择导入模式"
        footer={
          <div className="flex gap-2 justify-end">
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowImportMode(false); setImportFilePath(""); }}>
              取消
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleImportConfirm}>
              确认导入
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <label
            className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors hover-gold-bg"
            style={{ color: "var(--text-secondary)" }}
          >
            <input
              type="radio"
              name="importMode"
              checked={!importReplace}
              onChange={() => setImportReplace(false)}
            />
            <div>
              <span className="text-sm">追加导入</span>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>保留现有项目，将备份数据追加到当前数据库</p>
            </div>
          </label>
          <label
            className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors hover-gold-bg"
            style={{ color: "var(--text-secondary)" }}
          >
            <input
              type="radio"
              name="importMode"
              checked={importReplace}
              onChange={() => setImportReplace(true)}
            />
            <div>
              <span className="text-sm">替换导入</span>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>清除所有现有项目数据，还原为备份文件中的内容</p>
            </div>
          </label>
          {importReplace && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md" style={{ background: "var(--color-danger-light)", border: "1px solid var(--color-danger-medium)" }}>
              <AlertTriangle size={14} strokeWidth={1.5} style={{ color: "var(--color-danger)" }} />
              <p className="text-xs" style={{ color: "var(--color-danger)" }}>
                替换模式将永久删除所有现有项目数据，此操作不可撤销！
              </p>
            </div>
          )}
        </div>
      </Modal>
    </section>
  );
}