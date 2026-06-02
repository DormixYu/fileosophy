import { useState } from "react";
import { Upload, FolderOpen, Search, Loader2 } from "lucide-react";
import { useProjectStore } from "@/stores/useProjectStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useNotificationStore } from "@/stores/useNotificationStore";
import { exportApi, folderApi } from "@/lib/tauri-api";
import Modal from "@/components/common/Modal";
import DatePicker from "@/components/common/DatePicker";
import type { ScannedFolder } from "@/types";

type TabKey = "list" | "scan";

interface EditableRow extends ScannedFolder {
  selected: boolean;
  editName: string;
  editCode: string | null;
  editType: string | null;
  editStartDate: string | null;
  editEndDate: string | null;
  editStatus: string | null;
}

const CONF_COLORS: Record<string, { bg: string; border: string; dot: string }> = {
  high: { bg: "var(--color-success-light)", border: "var(--color-success)", dot: "var(--color-success)" },
  medium: { bg: "var(--color-warning-light)", border: "var(--color-warning)", dot: "var(--color-warning)" },
  low: { bg: "var(--color-danger-light)", border: "var(--color-danger)", dot: "var(--color-danger)" },
};

export default function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { parsedStatuses, parsedTypes } = useSettingsStore();
  const { addToast } = useNotificationStore();
  const [tab, setTab] = useState<TabKey>("list");
  const [csvPath, setCsvPath] = useState("");
  const [importing, setImporting] = useState(false);

  // 扫描
  const [scanPath, setScanPath] = useState("");
  const [scanning, setScanning] = useState(false);
  const [rows, setRows] = useState<EditableRow[]>([]);

  const handleSelectCsv = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ multiple: false, filters: [{ name: "CSV", extensions: ["csv"] }] });
      if (selected) setCsvPath(selected as string);
    } catch (e) {
      addToast({ type: "error", title: "选择文件失败", message: String(e) });
    }
  };

  const handleImportList = async () => {
    if (!csvPath) return;
    setImporting(true);
    try {
      const count = await exportApi.importProjectList(csvPath);
      addToast({ type: "success", title: "导入完成", message: `成功导入 ${count} 个项目` });
      useProjectStore.getState().fetchProjects();
      setCsvPath("");
    } catch (e) {
      addToast({ type: "error", title: "导入失败", message: String(e) });
    } finally {
      setImporting(false);
    }
  };

  const handleSelectScanPath = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ directory: true, multiple: false });
      if (selected) setScanPath(selected as string);
    } catch (e) {
      addToast({ type: "error", title: "选择目录失败", message: String(e) });
    }
  };

  const handleScan = async () => {
    if (!scanPath.trim()) return;
    setScanning(true);
    setRows([]);
    try {
      const data = await folderApi.scanFolders(scanPath);
      const editRows: EditableRow[] = data.map(d => ({
        ...d,
        selected: d.confidence !== "low",
        editName: d.parsed_name || d.folder_name,
        editCode: d.parsed_code,
        editType: d.inferred_type,
        editStartDate: d.inferred_date,
        editEndDate: d.inferred_end_date,
        editStatus: d.inferred_status,
      }));
      setRows(editRows);
      addToast({ type: "success", title: "扫描完成", message: `发现 ${data.length} 个文件夹` });
    } catch (e) {
      addToast({ type: "error", title: "扫描失败", message: String(e) });
    } finally {
      setScanning(false);
    }
  };

  const updateRow = (idx: number, field: keyof EditableRow, value: string | null) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const toggleRowSelect = (idx: number) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, selected: !r.selected } : r));
  };

  const highCount = rows.filter(r => r.confidence === "high").length;
  const medCount = rows.filter(r => r.confidence === "medium").length;
  const lowCount = rows.filter(r => r.confidence === "low").length;

  const handleConfirmImport = async () => {
    const selected = rows.filter(r => r.selected);
    if (selected.length === 0) return;
    setImporting(true);
    let success = 0;
    let fail = 0;
    for (const row of selected) {
      try {
        const updatedFolder: ScannedFolder = {
          ...row,
          parsed_name: row.editName,
          parsed_code: row.editCode,
          inferred_type: row.editType,
          inferred_date: row.editStartDate,
          inferred_end_date: row.editEndDate,
          inferred_status: row.editStatus,
        };
        await folderApi.importFromFolder(updatedFolder, row.editStatus ?? undefined, true);
        success++;
      } catch {
        fail++;
      }
    }
    useProjectStore.getState().fetchProjects();
    setRows(prev => prev.filter(r => !r.selected));
    addToast({
      type: fail > 0 ? "warning" : "success",
      title: "导入完成",
      message: `成功 ${success} 个${fail > 0 ? `，失败 ${fail} 个` : ""}`,
    });
    setImporting(false);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="导入"
      footer={
        <div className="flex gap-2 justify-end">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>取消</button>
          {tab === "list" && (
            <button className="btn btn-primary btn-sm" disabled={importing || !csvPath} onClick={handleImportList}>
              {importing ? "导入中..." : "导入"}
            </button>
          )}
          {tab === "scan" && rows.length > 0 && (
            <button className="btn btn-primary btn-sm" disabled={importing || rows.filter(r => r.selected).length === 0} onClick={handleConfirmImport}>
              {importing ? "导入中..." : `确认导入 (${rows.filter(r => r.selected).length})`}
            </button>
          )}
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
          <Upload size={14} strokeWidth={1.5} />
          列表导入
        </button>
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-md text-xs transition-all"
          style={{
            background: tab === "scan" ? "var(--bg-elevated)" : "transparent",
            color: tab === "scan" ? "var(--gold)" : "var(--text-secondary)",
            border: "none", cursor: "pointer",
          }}
          onClick={() => setTab("scan")}
        >
          <FolderOpen size={14} strokeWidth={1.5} />
          文件夹扫描
        </button>
      </div>

      {tab === "list" ? (
        <div>
          <p className="text-xs mb-3" style={{ color: "var(--text-tertiary)" }}>选择导出的 CSV 文件，自动识别项目信息并导入</p>
          <div className="flex items-center gap-2">
            <input type="text" value={csvPath} readOnly placeholder="选择 CSV 文件…" className="input-base flex-1 text-xs" />
            <button className="btn btn-outline btn-sm" onClick={handleSelectCsv}>
              <Upload size={13} strokeWidth={1.5} /> 选择
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 扫描路径 */}
          <div className="flex items-center gap-2">
            <input
              type="text" value={scanPath} onChange={e => setScanPath(e.target.value)}
              placeholder="选择或输入目录路径" className="input-base flex-1 text-xs"
            />
            <button className="btn btn-outline btn-sm" onClick={handleSelectScanPath}>
              <FolderOpen size={13} strokeWidth={1.5} /> 选择
            </button>
            <button className="btn btn-primary btn-sm" disabled={scanning || !scanPath.trim()} onClick={handleScan}>
              {scanning ? <Loader2 size={13} strokeWidth={1.5} className="animate-spin" /> : <Search size={13} strokeWidth={1.5} />}
              {scanning ? "扫描中…" : "扫描"}
            </button>
          </div>

          {/* 统计 */}
          {rows.length > 0 && (
            <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
              <span style={{ color: CONF_COLORS.high.dot }}>{highCount} 个完全匹配</span>
              <span style={{ color: CONF_COLORS.medium.dot }}>{medCount} 个需确认</span>
              <span style={{ color: CONF_COLORS.low.dot }}>{lowCount} 个未匹配</span>
            </div>
          )}

          {/* 可编辑表格 */}
          {rows.length > 0 && (
            <div className="max-h-[360px] overflow-y-auto space-y-1.5">
              {rows.map((row, idx) => {
                const conf = CONF_COLORS[row.confidence] || CONF_COLORS.low;
                return (
                  <div
                    key={row.path}
                    className="rounded-md p-3 space-y-2"
                    style={{ background: conf.bg, border: `1px solid ${conf.border}` }}
                  >
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={row.selected} onChange={() => toggleRowSelect(idx)} className="rounded" />
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: conf.dot }} />
                      <span className="text-xs truncate flex-1" style={{ color: "var(--text-primary)" }}>
                        {row.folder_name}
                      </span>
                      {row.conflict_reason && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: conf.border, color: "#fff" }}>
                          {row.conflict_reason}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-x-3 gap-y-1.5">
                      {/* 项目名称 */}
                      <div>
                        <label className="text-[10px]" style={{ color: "var(--text-muted)" }}>项目名称</label>
                        <input type="text" value={row.editName} onChange={e => updateRow(idx, "editName", e.target.value)} className="input-base w-full text-xs !py-0.5 !px-1.5" />
                      </div>
                      {/* 分类 */}
                      <div>
                        <label className="text-[10px]" style={{ color: "var(--text-muted)" }}>分类</label>
                        <select value={row.editType || ""} onChange={e => updateRow(idx, "editType", e.target.value)} className="input-base w-full text-xs !py-0.5 !px-1.5 !rounded-md">
                          <option value="">未分类</option>
                          {parsedTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                      {/* 状态 */}
                      <div>
                        <label className="text-[10px]" style={{ color: "var(--text-muted)" }}>状态</label>
                        <select value={row.editStatus || "planning"} onChange={e => updateRow(idx, "editStatus", e.target.value)} className="input-base w-full text-xs !py-0.5 !px-1.5 !rounded-md">
                          {parsedStatuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                      {/* 开始日期 */}
                      <div>
                        <label className="text-[10px]" style={{ color: "var(--text-muted)" }}>开始日期</label>
                        <DatePicker value={row.editStartDate || ""} onChange={v => updateRow(idx, "editStartDate", v)} placeholder="选择日期" className="w-full !py-0 !px-1 !text-xs !rounded-md" />
                      </div>
                      {/* 结束日期 */}
                      <div>
                        <label className="text-[10px]" style={{ color: "var(--text-muted)" }}>结束日期</label>
                        <DatePicker value={row.editEndDate || ""} onChange={v => updateRow(idx, "editEndDate", v)} placeholder="选择日期" className="w-full !py-0 !px-1 !text-xs !rounded-md" />
                      </div>
                      {/* 编号 */}
                      <div>
                        <label className="text-[10px]" style={{ color: "var(--text-muted)" }}>编号</label>
                        <input type="text" value={row.editCode || ""} onChange={e => updateRow(idx, "editCode", e.target.value)} placeholder="自动生成" className="input-base w-full text-xs !py-0.5 !px-1.5" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}