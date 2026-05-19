import { useState } from "react";
import { Download, Upload, FileJson } from "lucide-react";
import { useNotificationStore } from "@/stores/useNotificationStore";
import { exportApi } from "@/lib/tauri-api";
import ExportDialog from "@/components/settings/ExportDialog";
import ImportDialog from "@/components/settings/ImportDialog";

export default function DataSection() {
  const { addToast } = useNotificationStore();
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleExportJson = async () => {
    setExporting(true);
    try {
      const json = await exportApi.exportAllProjects(false);
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

  const handleImportJson = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!selected) return;
      setImporting(true);
      const projects = await exportApi.importAllProjects(selected as string, false);
      addToast({ type: "success", title: "导入完成", message: `成功导入 ${projects.length} 个项目` });
    } catch (e) {
      addToast({ type: "error", title: "导入失败", message: String(e) });
    } finally {
      setImporting(false);
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
        <h3 className="text-sm font-serif mb-2" style={{ color: "var(--text-secondary)" }}>
          完整备份与还原
        </h3>
        <p className="text-xs mb-3 font-mono" style={{ color: "var(--text-muted)" }}>
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
    </section>
  );
}