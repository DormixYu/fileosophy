import { useState } from "react";
import { Download, Upload, FileJson } from "lucide-react";
import { useNotificationStore } from "@/stores/useNotificationStore";
import { exportApi } from "@/lib/tauri-api";
import ExportDialog from "@/components/settings/ExportDialog";
import ImportDialog from "@/components/settings/ImportDialog";
import Modal from "@/components/common/Modal";

export default function DataSection() {
  const { addToast } = useNotificationStore();
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pendingImportPath, setPendingImportPath] = useState<string | null>(null);

  const handleExportJson = async () => {
    setExporting(true);
    try {
      const json = await exportApi.exportAllProjects(false);
      const { save } = await import("@tauri-apps/plugin-dialog");
      const filePath = await save({
        defaultPath: `fileosophy-backup-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (filePath) {
        const { writeTextFile } = await import("@tauri-apps/plugin-fs");
        await writeTextFile(filePath, json);
        addToast({ type: "success", title: "备份完成", message: "所有项目数据已导出" });
      }
    } catch (e) {
      addToast({ type: "error", title: "备份失败", message: String(e) });
    } finally {
      setExporting(false);
    }
  };

  const handleImportJson = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!selected) return;
      setPendingImportPath(selected as string);
    } catch (e) {
      addToast({ type: "error", title: "选择文件失败", message: String(e) });
    }
  };

  const executeImport = async (replace: boolean) => {
    if (!pendingImportPath) return;
    setImporting(true);
    try {
      const projects = await exportApi.importAllProjects(pendingImportPath, replace);
      addToast({ type: "success", title: "导入完成", message: `成功导入 ${projects.length} 个项目` });
    } catch (e) {
      addToast({ type: "error", title: "导入失败", message: String(e) });
    } finally {
      setImporting(false);
      setPendingImportPath(null);
    }
  };

  return (
    <section className="animate-slide-up">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-lg" style={{ color: "var(--text-primary)" }}>
          数据管理
        </h2>
      </div>

      {/* 导出与导入 */}
      <div className="flex gap-4 mb-6">
        <button className="btn btn-primary" onClick={() => setShowExport(true)}>
          <Download size={14} strokeWidth={1.5} />
          导出
        </button>
        <button className="btn btn-outline" onClick={() => setShowImport(true)}>
          <Upload size={14} strokeWidth={1.5} />
          导入
        </button>
      </div>

      {/* JSON 备份（次要） */}
      <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: 16 }}>
        <h3 className="text-base mb-2" style={{ color: "var(--text-secondary)" }}>
          完整备份与还原
        </h3>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
          JSON 格式备份所有项目数据，可用于跨设备迁移
        </p>
        <div className="flex gap-3">
          <button className="btn btn-ghost btn-sm" onClick={handleExportJson} disabled={exporting}>
            <FileJson size={13} strokeWidth={1.5} />
            {exporting ? "备份中..." : "JSON 备份"}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleImportJson} disabled={importing}>
            <FileJson size={13} strokeWidth={1.5} />
            {importing ? "还原中..." : "JSON 还原"}
          </button>
        </div>
      </div>

      <ExportDialog open={showExport} onClose={() => setShowExport(false)} />
      <ImportDialog open={showImport} onClose={() => setShowImport(false)} />

      <Modal
        open={pendingImportPath !== null}
        onClose={() => setPendingImportPath(null)}
        title="JSON 还原"
        width="max-w-sm"
        footer={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setPendingImportPath(null)}>
              取消
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => executeImport(false)}
              disabled={importing}
            >
              合并导入
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => executeImport(true)}
              disabled={importing}
            >
              覆盖导入
            </button>
          </>
        }
      >
        <div className="space-y-2">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            选择导入模式：
          </p>
          <ul className="text-xs space-y-1" style={{ color: "var(--text-muted)" }}>
            <li><strong>合并导入</strong>：保留现有数据，追加导入的项目</li>
            <li><strong>覆盖导入</strong>：清空所有现有数据后导入（不可恢复）</li>
          </ul>
        </div>
      </Modal>
    </section>
  );
}