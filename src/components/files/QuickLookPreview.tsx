import { useEffect, useCallback } from "react";
import { X, ExternalLink } from "lucide-react";
import type { FilePreview } from "@/types";
import TextPreview from "./previews/TextPreview";
import MarkdownPreview from "./previews/MarkdownPreview";
import ImagePreview from "./previews/ImagePreview";

interface Props {
  open: boolean;
  onClose: () => void;
  fileName: string;
  preview: FilePreview | null;
  loading: boolean;
  error: string | null;
  onOpenExternal?: () => void;
}

export default function QuickLookPreview({
  open,
  onClose,
  fileName,
  preview,
  loading,
  error,
  onOpenExternal,
}: Props) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === " ") {
        e.preventDefault();
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            加载中...
          </span>
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex items-center justify-center h-full">
          <span className="text-sm" style={{ color: "var(--color-danger)" }}>
            {error}
          </span>
        </div>
      );
    }
    if (!preview) return null;

    const { mime_type, content } = preview;
    if (mime_type.startsWith("image/")) {
      return <ImagePreview src={content} alt={fileName} />;
    }
    if (mime_type === "text/markdown") {
      return <MarkdownPreview content={content} />;
    }
    return <TextPreview content={content} />;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="relative flex flex-col rounded-xl overflow-hidden animate-scale-in"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
          boxShadow: "var(--shadow-gold)",
          width: "min(90vw, 800px)",
          height: "min(85vh, 600px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div
          className="flex items-center justify-between px-4 py-2.5 shrink-0"
          style={{ borderBottom: "1px solid var(--border-light)" }}
        >
          <span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>
            {fileName}
          </span>
          <div className="flex items-center gap-1.5">
            {onOpenExternal && (
              <button
                onClick={onOpenExternal}
                className="p-1.5 rounded-md transition-colors hover-gold-bg hover-gold-text"
                style={{ color: "var(--text-muted)" }}
                title="用系统应用打开"
              >
                <ExternalLink size={14} strokeWidth={1.5} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md transition-colors hover-gold-bg hover-gold-text"
              style={{ color: "var(--text-muted)" }}
            >
              <X size={14} strokeWidth={1.5} />
            </button>
          </div>
        </div>
        {/* 内容 */}
        <div className="flex-1 overflow-auto">{renderContent()}</div>
        {/* 底部提示 */}
        <div
          className="text-center py-1.5 shrink-0"
          style={{ borderTop: "1px solid var(--border-light)" }}
        >
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            按 空格 或 Esc 关闭预览
          </span>
        </div>
      </div>
    </div>
  );
}
