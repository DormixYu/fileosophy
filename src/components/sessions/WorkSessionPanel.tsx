import { useEffect, useState, useCallback } from "react";
import { Save, RotateCcw, Trash2, Clock } from "lucide-react";
import { workSessionApi } from "@/lib/tauri-api";
import { useNotificationStore } from "@/stores/useNotificationStore";
import type { WorkSession } from "@/types";
import { formatDateTime } from "@/lib/formatUtils";
import { ConfirmDialog } from "@/components/common/Modal";

interface Props {
  projectId: number;
  activeTab: string;
  activeKanbanCardId: number | null;
  openFiles: string[]; // 当前打开的文件路径/ID 列表
  onRestore: (session: WorkSession) => void;
}

export default function WorkSessionPanel({
  projectId,
  activeTab,
  activeKanbanCardId,
  openFiles,
  onRestore,
}: Props) {
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [saving, setSaving] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [showNameInput, setShowNameInput] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { addToast } = useNotificationStore();

  const fetchSessions = useCallback(async () => {
    try {
      const data = await workSessionApi.getAll(projectId);
      setSessions(data);
    } catch (e) {
      console.error("获取工作会话失败:", e);
    }
  }, [projectId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await workSessionApi.save(
        projectId,
        JSON.stringify(openFiles),
        activeTab,
        activeKanbanCardId,
        sessionName || undefined,
      );
      addToast({ type: "success", title: "会话已保存", message: "当前工作状态已保存" });
      setShowNameInput(false);
      setSessionName("");
      await fetchSessions();
    } catch (e) {
      addToast({ type: "error", title: "保存失败", message: String(e) });
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async (session: WorkSession) => {
    try {
      await workSessionApi.restore(session.id);
      onRestore(session);
      addToast({ type: "success", title: "会话已恢复", message: session.name });
    } catch (e) {
      addToast({ type: "error", title: "恢复失败", message: String(e) });
    }
  };

  const handleDelete = async () => {
    if (deletingId === null) return;
    try {
      await workSessionApi.delete(deletingId);
      setSessions((prev) => prev.filter((s) => s.id !== deletingId));
      addToast({ type: "info", title: "会话已删除", message: "已删除工作会话" });
    } catch (e) {
      addToast({ type: "error", title: "删除失败", message: String(e) });
    } finally {
      setDeletingId(null);
    }
  };

  const tabLabel = (tab: string) => {
    if (tab === "kanban") return "看板";
    if (tab === "gantt") return "甘特图";
    return "文件";
  };

  return (
    <div className="space-y-4">
      {/* 保存当前会话 */}
      <div className="flex items-center gap-2">
        {showNameInput ? (
          <>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="会话名称（可选）"
              className="input-base text-xs flex-1"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") setShowNameInput(false);
              }}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "保存中..." : "保存"}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowNameInput(false)}
            >
              取消
            </button>
          </>
        ) : (
          <button
            className="btn btn-outline btn-sm hover-gold-text"
            onClick={() => setShowNameInput(true)}
            disabled={saving}
          >
            <Save size={13} strokeWidth={1.5} />
            保存当前会话
          </button>
        )}
      </div>

      {/* 会话列表 */}
      {sessions.length === 0 ? (
        <div
          className="text-xs text-center py-6"
          style={{ color: "var(--text-muted)" }}
        >
          暂无保存的工作会话
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => {
            let fileCount = 0;
            try {
              const parsed = JSON.parse(session.open_files);
              if (Array.isArray(parsed)) fileCount = parsed.length;
            } catch {
              /* ignore */
            }

            return (
              <div
                key={session.id}
                className="flex items-center gap-3 p-2.5 rounded-lg transition-colors"
                style={{
                  background: "var(--bg-surface-alt)",
                  border: "1px solid var(--border-light)",
                }}
              >
                <div className="flex-1 min-w-0">
                  <div
                    className="text-xs font-medium truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {session.name}
                  </div>
                  <div
                    className="flex items-center gap-2 mt-1 text-[10px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <span>{tabLabel(session.active_tab)}</span>
                    {fileCount > 0 && <span>· {fileCount} 个文件</span>}
                    <span className="flex items-center gap-0.5">
                      <Clock size={9} strokeWidth={1.5} />
                      {formatDateTime(session.created_at)}
                    </span>
                  </div>
                </div>
                <button
                  className="p-1.5 rounded-md transition-colors hover-gold-bg"
                  style={{ color: "var(--gold)" }}
                  onClick={() => handleRestore(session)}
                  title="恢复此会话"
                >
                  <RotateCcw size={13} strokeWidth={1.5} />
                </button>
                <button
                  className="p-1.5 rounded-md transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  onClick={() => setDeletingId(session.id)}
                  title="删除此会话"
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "var(--color-danger)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "var(--text-muted)")
                  }
                >
                  <Trash2 size={13} strokeWidth={1.5} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={deletingId !== null}
        title="删除会话"
        message="确定删除此工作会话？此操作不可撤销。"
        confirmLabel="删除"
        cancelLabel="取消"
        danger
        onConfirm={handleDelete}
        onClose={() => setDeletingId(null)}
      />
    </div>
  );
}
