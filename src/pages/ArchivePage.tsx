import { useEffect, useState, useMemo } from "react";
import { Search, X, Archive, ArchiveRestore, Package } from "lucide-react";
import { archiveApi } from "@/lib/tauri-api";
import { useNotificationStore } from "@/stores/useNotificationStore";
import Modal from "@/components/common/Modal";
import type { ArchivedProject } from "@/types";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ArchivePage() {
  const [archives, setArchives] = useState<ArchivedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [unarchiveId, setUnarchiveId] = useState<number | null>(null);
  const { addToast } = useNotificationStore();

  const fetchArchives = async () => {
    try {
      setLoading(true);
      const data = await archiveApi.getAll();
      setArchives(data);
    } catch (e) {
      console.error("加载归档列表失败:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchives();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return archives;
    const q = search.toLowerCase();
    return archives.filter(
      (a) =>
        a.project_name.toLowerCase().includes(q) ||
        (a.project_number || "").toLowerCase().includes(q) ||
        (a.project_type || "").toLowerCase().includes(q)
    );
  }, [archives, search]);

  const handleUnarchive = async () => {
    if (unarchiveId === null) return;
    try {
      await archiveApi.unarchive(unarchiveId);
      addToast({ type: "success", title: "解归档成功", message: "项目已恢复到主列表" });
      setUnarchiveId(null);
      fetchArchives();
    } catch (e) {
      addToast({ type: "error", title: "解归档失败", message: String(e) });
    }
  };

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* 页头 */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0">
        <div>
          <h1 className="text-title" style={{ color: "var(--text-primary)" }}>
            归档库
          </h1>
          <p className="text-caption mt-0.5" style={{ color: "var(--text-muted)" }}>
            {loading ? "加载中..." : `共 ${archives.length} 个归档项目`}
          </p>
        </div>
      </div>

      {/* 搜索栏 */}
      <div className="flex items-center gap-2 px-6 pb-3 shrink-0">
        <div className="search-input-wrapper" style={{ maxWidth: 280 }}>
          <Search size={14} strokeWidth={1.5} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <input
            type="text"
            placeholder="搜索项目名、编号..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}
            >
              <X size={12} strokeWidth={1.5} />
            </button>
          )}
        </div>
        <span className="text-caption ml-auto" style={{ color: "var(--text-muted)" }}>
          {filtered.length} 个归档
        </span>
      </div>

      {/* 列表区域 */}
      <div className="flex-1 overflow-auto px-6 pb-5">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="text-caption" style={{ color: "var(--text-muted)" }}>加载中...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 animate-fade-in">
            <div className="empty-illustration">
              <Archive size={40} strokeWidth={1.2} style={{ color: "var(--gold)" }} />
            </div>
            <h3 className="text-heading mt-5" style={{ color: "var(--text-primary)" }}>
              {search ? "没有匹配的归档" : "暂无归档项目"}
            </h3>
            <p className="text-caption mt-1.5 max-w-xs text-center" style={{ color: "var(--text-muted)" }}>
              {search ? "尝试调整搜索关键词" : "在项目列表中归档已完成的项目"}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 animate-stagger" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {filtered.map((archive) => (
              <div
                key={archive.id}
                className="rounded-lg p-4 transition-all duration-200"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-default)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--gold)";
                  e.currentTarget.style.boxShadow = "var(--shadow-gold-sm)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-default)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Package size={14} strokeWidth={1.5} style={{ color: "var(--gold)", flexShrink: 0 }} />
                      <h3
                        className="text-sm font-medium truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {archive.project_name}
                      </h3>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {archive.project_number && (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px]"
                          style={{
                            background: "var(--gold-glow-strong)",
                            color: "var(--gold)",
                          }}
                        >
                          {archive.project_number}
                        </span>
                      )}
                      {archive.project_type && (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px]"
                          style={{
                            background: "var(--bg-elevated)",
                            color: "var(--text-secondary)",
                          }}
                        >
                          {archive.project_type}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
                      <span>{formatFileSize(archive.file_size)}</span>
                      <span>·</span>
                      <span>{archive.archived_at}</span>
                    </div>
                  </div>
                  <button
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: "var(--gold)", background: "none", border: "none", cursor: "pointer" }}
                    title="解归档"
                    onClick={() => setUnarchiveId(archive.id)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--gold-glow-strong)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  >
                    <ArchiveRestore size={16} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 解归档确认弹窗 */}
      {unarchiveId !== null && (
        <Modal
          open={true}
          onClose={() => setUnarchiveId(null)}
          title="确认解归档"
          footer={
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => setUnarchiveId(null)}>取消</button>
              <button className="btn btn-primary btn-sm" onClick={handleUnarchive}>
                解归档
              </button>
            </>
          }
        >
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            确定解归档此项目？项目将恢复到原始路径，并重新出现在项目列表中。
          </p>
        </Modal>
      )}
    </div>
  );
}
