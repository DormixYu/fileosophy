import { useEffect, useState, useCallback, useRef } from "react";
import {
  Upload,
  Trash2,
  FileIcon,
  Send,
  Share2,
  RefreshCw,
  Monitor,
  Download,
  Eye,
  Star,
  StickyNote,
} from "lucide-react";
import type { FileEntry, FilePreview, Peer, FileBookmark } from "@/types";
import { INLINE_PREVIEW_EXTS, getFileExt } from "@/types";
import { fileApi, fileBookmarkApi } from "@/lib/tauri-api";
import { formatSize } from "@/lib/formatUtils";
import { useNotificationStore } from "@/stores/useNotificationStore";
import { ConfirmDialog } from "@/components/common/Modal";
import FilePreviewModal from "./FilePreviewModal";
import FileBookmarkBar from "./FileBookmarkBar";
import QuickLookPreview from "./QuickLookPreview";

interface Props {
  projectId: number;
}

export default function FilePanel({ projectId }: Props) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [peersLoading, setPeersLoading] = useState(false);
  const [sharingFileId, setSharingFileId] = useState<number | null>(null);
  const [showPeerPanel, setShowPeerPanel] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // 文件预览状态
  const [previewIndex, setPreviewIndex] = useState<number>(-1);
  const [previewData, setPreviewData] = useState<FilePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // QuickLook 状态
  const [quickLookIndex, setQuickLookIndex] = useState<number>(-1);
  const [quickLookData, setQuickLookData] = useState<FilePreview | null>(null);
  const [quickLookLoading, setQuickLookLoading] = useState(false);
  const [quickLookError, setQuickLookError] = useState<string | null>(null);

  // 书签状态
  const [bookmarks, setBookmarks] = useState<FileBookmark[]>([]);
  const [noteEditBookmark, setNoteEditBookmark] = useState<FileBookmark | null>(null);
  const [noteText, setNoteText] = useState("");
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(-1);

  const addToast = useNotificationStore((s) => s.addToast);
  const listRef = useRef<HTMLDivElement>(null);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const list = await fileApi.list(projectId);
      setFiles(list);
    } catch (e) {
      console.error("Failed to fetch files:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchBookmarks = useCallback(async () => {
    try {
      const list = await fileBookmarkApi.getAll(projectId);
      setBookmarks(list);
    } catch (e) {
      console.error("Failed to fetch bookmarks:", e);
    }
  }, [projectId]);

  const fetchPeers = useCallback(async () => {
    setPeersLoading(true);
    try {
      const list = await fileApi.discoverPeers();
      setPeers(list);
    } catch (e) {
      console.error("Failed to discover peers:", e);
    } finally {
      setPeersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
    fetchBookmarks();
  }, [projectId, fetchBookmarks]);

  useEffect(() => {
    if (showPeerPanel) {
      fetchPeers();
      const interval = setInterval(fetchPeers, 5000);
      return () => clearInterval(interval);
    }
  }, [showPeerPanel, fetchPeers]);

  // 空格键触发 QuickLook
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " && selectedFileIndex >= 0 && quickLookIndex < 0 && previewIndex < 0) {
        // 忽略输入框内的空格
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        triggerQuickLook(selectedFileIndex);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedFileIndex, quickLookIndex, previewIndex, files]);

  const triggerQuickLook = useCallback(
    async (index: number) => {
      const file = files[index];
      if (!file) return;
      const ext = getFileExt(file.original_name);
      if (!INLINE_PREVIEW_EXTS.has(ext)) {
        await handleOpenExternal(file.id);
        return;
      }
      setQuickLookIndex(index);
      setQuickLookLoading(true);
      setQuickLookError(null);
      setQuickLookData(null);
      try {
        const data = await fileApi.preview(file.id);
        setQuickLookData(data);
      } catch (e) {
        setQuickLookError(String(e));
      } finally {
        setQuickLookLoading(false);
      }
    },
    [files],
  );

  const handleUpload = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ multiple: true });
      if (!selected) return;

      const paths = Array.isArray(selected) ? selected : [selected];
      for (const path of paths) {
        await fileApi.upload(projectId, path);
      }
      await fetchFiles();
    } catch (e) {
      addToast({ type: "error", title: "上传失败", message: String(e) });
    }
  };

  const handleOpenExternal = async (fileId: number) => {
    try {
      await fileApi.openStoredFile(fileId);
    } catch (e) {
      addToast({ type: "error", title: "打开失败", message: String(e) });
    }
  };

  const handleDelete = async (fileId: number) => {
    try {
      await fileApi.delete(fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (e) {
      addToast({ type: "error", title: "删除失败", message: String(e) });
    }
  };

  const handleShare = async (fileId: number, peer: Peer) => {
    setSharingFileId(fileId);
    try {
      const addr = peer.addresses[0] || peer.host;
      await fileApi.shareOverNetwork(fileId, addr, peer.port, peer.token);
      addToast({ type: "success", title: "发送成功", message: `文件已发送到 ${peer.name}` });
    } catch (e) {
      addToast({ type: "error", title: "发送失败", message: String(e) });
    } finally {
      setSharingFileId(null);
    }
  };

  // 打开内联预览（按文件列表索引）
  const openPreview = useCallback(
    async (index: number) => {
      const file = files[index];
      if (!file) return;
      const ext = getFileExt(file.original_name);
      if (!INLINE_PREVIEW_EXTS.has(ext)) {
        await handleOpenExternal(file.id);
        return;
      }
      setPreviewIndex(index);
      setPreviewLoading(true);
      setPreviewError(null);
      setPreviewData(null);
      try {
        const data = await fileApi.preview(file.id);
        setPreviewData(data);
      } catch (e) {
        setPreviewError(String(e));
      } finally {
        setPreviewLoading(false);
      }
    },
    [files],
  );

  const closePreview = () => {
    setPreviewIndex(-1);
    setPreviewData(null);
    setPreviewError(null);
  };

  const handlePrev = useCallback(() => {
    if (previewIndex > 0) openPreview(previewIndex - 1);
  }, [previewIndex, openPreview]);

  const handleNext = useCallback(() => {
    if (previewIndex < files.length - 1) openPreview(previewIndex + 1);
  }, [previewIndex, files.length, openPreview]);

  const handlePreviewOpenExternal = useCallback(async () => {
    const file = files[previewIndex];
    if (file) await handleOpenExternal(file.id);
  }, [files, previewIndex]);

  // ── 书签操作 ──────────────────────────────────────────────

  const getBookmarkForFile = (fileName: string) =>
    bookmarks.find((b) => b.file_name === fileName && b.starred);

  const handleToggleStar = async (file: FileEntry) => {
    const existing = getBookmarkForFile(file.original_name);
    if (existing) {
      try {
        await fileBookmarkApi.update(existing.id, undefined, false);
        setBookmarks((prev) =>
          prev.map((b) => (b.id === existing.id ? { ...b, starred: false } : b)),
        );
      } catch (e) {
        addToast({ type: "error", title: "操作失败", message: String(e) });
      }
    } else {
      try {
        const filePath =
          file.stored_name || `db://${file.project_id}/${file.original_name}`;
        const bm = await fileBookmarkApi.create(
          projectId,
          file.original_name,
          filePath,
        );
        setBookmarks((prev) => [bm, ...prev]);
      } catch (e) {
        addToast({ type: "error", title: "操作失败", message: String(e) });
      }
    }
  };

  const handleUnstar = async (bookmarkId: number) => {
    try {
      await fileBookmarkApi.update(bookmarkId, undefined, false);
      setBookmarks((prev) =>
        prev.map((b) => (b.id === bookmarkId ? { ...b, starred: false } : b)),
      );
    } catch (e) {
      addToast({ type: "error", title: "操作失败", message: String(e) });
    }
  };

  const handleSaveNote = async () => {
    if (!noteEditBookmark) return;
    try {
      const updated = await fileBookmarkApi.update(
        noteEditBookmark.id,
        noteText,
        undefined,
      );
      setBookmarks((prev) =>
        prev.map((b) => (b.id === updated.id ? updated : b)),
      );
      setNoteEditBookmark(null);
      setNoteText("");
    } catch (e) {
      addToast({ type: "error", title: "保存失败", message: String(e) });
    }
  };

  const handleOpenNoteDialog = (file: FileEntry) => {
    const existing = bookmarks.find((b) => b.file_name === file.original_name);
    if (existing) {
      setNoteEditBookmark(existing);
      setNoteText(existing.note || "");
    } else {
      // 需要先创建 bookmark
      const filePath =
        file.stored_name || `db://${file.project_id}/${file.original_name}`;
      fileBookmarkApi
        .create(projectId, file.original_name, filePath)
        .then((bm) => {
          setBookmarks((prev) => [bm, ...prev]);
          setNoteEditBookmark(bm);
          setNoteText("");
        })
        .catch((e) =>
          addToast({ type: "error", title: "操作失败", message: String(e) }),
        );
    }
  };

  const handleBookmarkOpen = (bookmark: FileBookmark) => {
    const idx = files.findIndex((f) => f.original_name === bookmark.file_name);
    if (idx >= 0) {
      openPreview(idx);
    } else {
      addToast({ type: "info", title: "提示", message: "文件不在当前列表中" });
    }
  };

  const previewFile = previewIndex >= 0 ? files[previewIndex] : null;
  const quickLookFile = quickLookIndex >= 0 ? files[quickLookIndex] : null;

  return (
    <div className="space-y-4">
      {/* 标记文件置顶区 */}
      <FileBookmarkBar
        bookmarks={bookmarks}
        onOpen={handleBookmarkOpen}
        onUnstar={handleUnstar}
        onEditNote={(b) => {
          setNoteEditBookmark(b);
          setNoteText(b.note || "");
        }}
      />

      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <h3 className="text-base" style={{ color: "var(--text-primary)" }}>
          文件
        </h3>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setShowPeerPanel(!showPeerPanel)}
            style={
              showPeerPanel
                ? { borderColor: "var(--gold)", color: "var(--gold)", background: "var(--gold-glow)" }
                : {}
            }
          >
            <Share2 size={14} strokeWidth={1.5} />
            局域网共享
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleUpload}>
            <Upload size={14} strokeWidth={1.5} />
            上传文件
          </button>
        </div>
      </div>

      {/* 对等节点面板 */}
      {showPeerPanel && (
        <div
          className="card animate-slide-up"
          style={{ background: "var(--bg-elevated)", boxShadow: "var(--shadow-gold)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center justify-center w-5 h-5 rounded-full shrink-0"
                style={{ background: "var(--gold-glow)", color: "var(--gold)" }}
              >
                <Monitor size={10} strokeWidth={1.5} />
              </span>
              <h4 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                局域网中的 Fileosophy 实例
              </h4>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={fetchPeers} disabled={peersLoading}>
              <RefreshCw size={12} strokeWidth={1.5} className={peersLoading ? "animate-spin" : ""} />
              刷新
            </button>
          </div>
          {peers.length === 0 ? (
            <div className="text-center py-4 text-xs" style={{ color: "var(--text-muted)" }}>
              {peersLoading ? "正在搜索..." : "未发现其他实例，请确认对方已启动"}
            </div>
          ) : (
            <div className="space-y-1.5">
              {peers.map((peer, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors hover-gold-bg"
                  style={{ background: "var(--bg-surface-alt)" }}
                >
                  <Monitor size={14} strokeWidth={1.5} style={{ color: "var(--color-success)" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate" style={{ color: "var(--text-primary)" }}>
                      {peer.name}
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {peer.addresses[0]}:{peer.port}
                    </p>
                  </div>
                  <span
                    className="badge"
                    style={{
                      background: "var(--color-success-light)",
                      color: "var(--color-success)",
                      fontSize: "10px",
                    }}
                  >
                    在线
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 文件列表 */}
      {loading ? (
        <div className="text-center py-8 text-xs" style={{ color: "var(--text-muted)" }}>
          加载中...
        </div>
      ) : files.length === 0 ? (
        <div className="card text-center py-8">
          <FileIcon size={32} strokeWidth={1} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
            暂无文件
          </p>
          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
            选中文件后按 空格键 可快速预览
          </p>
        </div>
      ) : (
        <div className="space-y-1" ref={listRef}>
          {files.map((file, index) => {
            const isBookmarked = !!getBookmarkForFile(file.original_name);
            const isSelected = selectedFileIndex === index;
            return (
              <div
                key={file.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-all group cursor-pointer select-none ${
                  isSelected ? "ring-1" : ""
                }`}
                style={{
                  background: isSelected ? "var(--gold-glow)" : "var(--bg-surface-alt)",
                  ...(isSelected ? { ringColor: "var(--gold)" } : {}),
                }}
                onClick={() => setSelectedFileIndex(index)}
                onDoubleClick={() => openPreview(index)}
              >
                <FileIcon size={16} strokeWidth={1.5} style={{ color: "var(--gold)", flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate" style={{ color: "var(--text-primary)" }}>
                    {file.original_name}
                  </p>
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {formatSize(file.size)} · {new Date(file.uploaded_at).toLocaleDateString("zh-CN")}
                  </p>
                </div>

                {/* 分享按钮 */}
                {showPeerPanel && peers.length > 0 && (
                  <div className="relative group/share">
                    <button
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover-gold-bg hover-gold-text"
                      style={{ color: "var(--text-muted)" }}
                      title="发送到局域网"
                    >
                      <Send size={14} strokeWidth={1.5} />
                    </button>
                    <div
                      className="absolute right-0 top-full mt-1 py-1.5 rounded-lg opacity-0 group-hover/share:opacity-100 pointer-events-none group-hover/share:pointer-events-auto transition-opacity z-10 animate-scale-in"
                      style={{
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border-default)",
                        boxShadow: "var(--shadow-gold)",
                        minWidth: 200,
                      }}
                    >
                      {peers.map((peer, i) => (
                        <button
                          key={i}
                          className="w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center gap-2 hover-gold-bg"
                          style={{ color: "var(--text-secondary)" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShare(file.id, peer);
                          }}
                          disabled={sharingFileId === file.id}
                        >
                          <Monitor size={12} strokeWidth={1.5} />
                          {peer.name}
                          {sharingFileId === file.id && (
                            <RefreshCw size={10} className="animate-spin ml-auto" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 操作按钮 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleStar(file);
                  }}
                  className={`opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded-md hover-gold-bg ${
                    isBookmarked ? "!opacity-100" : ""
                  }`}
                  style={{ color: isBookmarked ? "var(--gold)" : "var(--text-muted)" }}
                  title={isBookmarked ? "取消标记" : "标记文件"}
                >
                  <Star size={14} strokeWidth={1.5} fill={isBookmarked ? "var(--gold)" : "none"} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenNoteDialog(file);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded-md hover-gold-bg hover-gold-text"
                  style={{ color: "var(--text-muted)" }}
                  title="添加备注"
                >
                  <StickyNote size={14} strokeWidth={1.5} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openPreview(index);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded-md hover-gold-bg hover-gold-text"
                  style={{ color: "var(--text-muted)" }}
                  title="预览 (双击)"
                >
                  <Eye size={14} strokeWidth={1.5} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenExternal(file.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded-md hover-gold-bg hover-gold-text"
                  style={{ color: "var(--text-muted)" }}
                  title="用系统应用打开"
                >
                  <Download size={14} strokeWidth={1.5} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirmId(file.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded-md hover-danger-text"
                  style={{ color: "var(--text-muted)" }}
                >
                  <Trash2 size={14} strokeWidth={1.5} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        open={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => {
          if (deleteConfirmId) handleDelete(deleteConfirmId);
        }}
        title="删除文件"
        message="确定删除此文件？删除后无法恢复。"
        confirmLabel="删除"
        danger
      />

      {/* 备注编辑弹窗 */}
      {noteEditBookmark && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setNoteEditBookmark(null)}
        >
          <div
            className="card animate-scale-in"
            style={{ width: "min(90vw, 420px)", background: "var(--bg-elevated)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm mb-3" style={{ color: "var(--text-primary)" }}>
              备注 — {noteEditBookmark.file_name}
            </h3>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="输入备注..."
              rows={3}
              className="input w-full resize-none mb-3"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => setNoteEditBookmark(null)}>
                取消
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleSaveNote}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QuickLook 风格文件预览 */}
      <FilePreviewModal
        open={previewIndex >= 0}
        onClose={closePreview}
        preview={previewData}
        loading={previewLoading}
        error={previewError}
        fileName={previewFile?.original_name ?? ""}
        hasPrev={previewIndex > 0}
        hasNext={previewIndex < files.length - 1}
        onPrev={handlePrev}
        onNext={handleNext}
        onOpenExternal={handlePreviewOpenExternal}
      />

      {/* QuickLook 预览（空格触发） */}
      <QuickLookPreview
        open={quickLookIndex >= 0}
        onClose={() => {
          setQuickLookIndex(-1);
          setQuickLookData(null);
          setQuickLookError(null);
        }}
        fileName={quickLookFile?.original_name ?? ""}
        preview={quickLookData}
        loading={quickLookLoading}
        error={quickLookError}
        onOpenExternal={
          quickLookFile ? () => handleOpenExternal(quickLookFile.id) : undefined
        }
      />
    </div>
  );
}
