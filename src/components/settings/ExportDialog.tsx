import { useState } from "react";
import { FileSpreadsheet, Archive } from "lucide-react";
import { useProjectStore } from "@/stores/useProjectStore";
import { useNotificationStore } from "@/stores/useNotificationStore";
import { exportApi } from "@/lib/tauri-api";
import Modal from "@/components/common/Modal";

type TabKey = "list" | "files";

const FIELD_OPTIONS = [
  { key: "number", label: "编号" },
  { key: "name", label: "名称" },
  { key: "type", label: "分类" },
  { key: "status", label: "状态" },
  { key: "status_time", label: "状态变动时间" },
  { key: "start_date", label: "开始日期" },
  { key: "end_date", label: "结束日期" },
  { key: "created_by", label: "创建人" },
  { key: "folder_path", label: "文件夹路径" },
];

export default function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { projects } = useProjectStore();
  const { addToast } = useNotificationStore();
  const [tab, setTab] = useState<TabKey>("list");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set(FIELD_OPTIONS.map(f => f.key)));
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const toggleAll = () => {
    if (selectedIds.size === projects.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(projects.map(p => p.id)));
  };

  const toggleId = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleField = (key: string) => {
    setSelectedFields(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleExportList = async () => {
    if (selectedIds.size === 0 || selectedFields.size === 0) return;
    setExporting(true);
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const defaultName = `fileosophy-export-${new Date().toISOString().slice(0, 10)}.csv`;
      const savePath = await save({ defaultPath: defaultName, filters: [{ name: "CSV", extensions: ["csv"] }] });
      if (!savePath) { setExporting(false); return; }
      await exportApi.exportProjectList([...selectedIds], [...selectedFields], savePath);
      addToast({ type: "success", title: "导出完成", message: `已导出 ${selectedIds.size} 个项目到 CSV` });
    } catch (e) {
      addToast({ type: "error", title: "导出失败", message: String(e) });
    } finally {
      setExporting(false);
    }
  };

  const handleExportFiles = async () => {
    if (!selectedProjectId) return;
    const project = projects.find(p => p.id === selectedProjectId);
    if (!project?.folder_path) {
      addToast({ type: "warning", title: "无法导出", message: "该项目未关联文件夹" });
      return;
    }
    setExporting(true);
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const defaultName = `${project.name}.zip`;
      const savePath = await save({ defaultPath: defaultName, filters: [{ name: "ZIP", extensions: ["zip"] }] });
      if (!savePath) { setExporting(false); return; }
      const size = await exportApi.exportProjectFiles(selectedProjectId, savePath);
      const sizeStr = size > 1048576 ? `${(size / 1048576).toFixed(1)} MB` : `${(size / 1024).toFixed(1)} KB`;
      addToast({ type: "success", title: "导出完成", message: `压缩包 ${sizeStr}` });
    } catch (e) {
      addToast({ type: "error", title: "导出失败", message: String(e) });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="导出"
      footer={
        <div className="flex gap-2 justify-end">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>取消</button>
          <button
            className="btn btn-primary btn-sm"
            disabled={exporting || (tab === "list" ? selectedIds.size === 0 || selectedFields.size === 0 : !selectedProjectId)}
            onClick={tab === "list" ? handleExportList : handleExportFiles}
          >
            {exporting ? "导出中..." : "导出"}
          </button>
        </div>
      }
    >
      {/* Tab */}
      <div className="flex gap-1 p-1 rounded-lg mb-4" style={{ background: "var(--bg-surface-alt)" }}>
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-md text-xs transition-all"
          style={{
            background: tab === "list" ? "var(--bg-elevated)" : "transparent",
            color: tab === "list" ? "var(--gold)" : "var(--text-secondary)",
            border: "none", cursor: "pointer",
          }}
          onClick={() => setTab("list")}
        >
          <FileSpreadsheet size={14} strokeWidth={1.5} />
          项目列表
        </button>
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-md text-xs transition-all"
          style={{
            background: tab === "files" ? "var(--bg-elevated)" : "transparent",
            color: tab === "files" ? "var(--gold)" : "var(--text-secondary)",
            border: "none", cursor: "pointer",
          }}
          onClick={() => setTab("files")}
        >
          <Archive size={14} strokeWidth={1.5} />
          项目文件
        </button>
      </div>

      {tab === "list" ? (
        <div className="space-y-4">
          {/* 项目多选 */}
          <div>
            <label className="flex items-center gap-2 mb-2 text-xs cursor-pointer" style={{ color: "var(--text-secondary)" }}>
              <input type="checkbox" checked={selectedIds.size === projects.length && projects.length > 0} onChange={toggleAll} className="rounded" />
              全选 ({selectedIds.size}/{projects.length})
            </label>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {projects.map(p => (
                <label key={p.id} className="flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer hover-gold-bg" style={{ color: "var(--text-primary)" }}>
                  <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleId(p.id)} className="rounded" />
                  <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{p.project_number || "-"}</span>
                  <span className="text-xs truncate">{p.name}</span>
                </label>
              ))}
            </div>
          </div>
          {/* 字段勾选 */}
          <div>
            <p className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>导出字段</p>
            <div className="grid grid-cols-3 gap-2">
              {FIELD_OPTIONS.map(f => (
                <label key={f.key} className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--text-secondary)" }}>
                  <input type="checkbox" checked={selectedFields.has(f.key)} onChange={() => toggleField(f.key)} className="rounded" />
                  {f.label}
                </label>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-xs mb-3" style={{ color: "var(--text-tertiary)" }}>选择一个项目，将其关联的文件夹打包为 zip 压缩包</p>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {projects.map(p => (
              <button
                key={p.id}
                className="w-full text-left px-3 py-2 rounded-md text-xs transition-all hover-gold-bg"
                style={{
                  color: "var(--text-primary)",
                  background: selectedProjectId === p.id ? "var(--gold-glow)" : "transparent",
                  border: selectedProjectId === p.id ? "1px solid var(--gold)" : "1px solid transparent",
                  cursor: "pointer",
                }}
                onClick={() => setSelectedProjectId(p.id)}
              >
                <span className="font-mono" style={{ color: "var(--text-muted)" }}>{p.project_number || "-"}</span>
                {" "}{p.name}
                {!p.folder_path && <span style={{ color: "var(--color-danger)", marginLeft: 8 }}>(未关联文件夹)</span>}
              </button>
            ))}
          </div>
          {selectedProjectId && (
            <p className="text-xs mt-2 font-mono" style={{ color: "var(--text-muted)" }}>
              文件夹: {projects.find(p => p.id === selectedProjectId)?.folder_path || "无"}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}