import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
  headerExtra?: React.ReactNode;
  fullScreen?: boolean;
}

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = "max-w-md",
  headerExtra,
  fullScreen = false,
}: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
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

  if (fullScreen) {
    return createPortal(
      <div
        className="fixed inset-0 z-[60] flex flex-col animate-fade-in"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)" }}
      >
        {children}
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      style={{
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(12px) saturate(1.2)",
      }}
      onClick={onClose}
    >
      <div
        className={`w-full ${width} mx-4 animate-scale-in`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="overflow-hidden max-h-[85vh] flex flex-col"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-xl)",
          }}
        >
          {/* 头部 */}
          {title && (
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: "1px solid var(--border-light)" }}
            >
              <h2
                className="text-base font-semibold truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {title}
              </h2>
              <div className="flex items-center gap-2 shrink-0">
                {headerExtra}
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg transition-all hover-gold-bg"
                  style={{ color: "var(--text-muted)" }}
                  aria-label="关闭"
                >
                  <X size={16} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          )}

          {/* 内容 */}
          <div className="px-6 py-5 overflow-y-auto">{children}</div>

          {/* 底部 */}
          {footer && (
            <div
              className="flex items-center justify-end gap-2 px-6 py-3.5"
              style={{ borderTop: "1px solid var(--border-light)" }}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  title = "确认操作",
  message,
  confirmLabel = "确认",
  cancelLabel = "取消",
  danger,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="max-w-sm"
      footer={
        <>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            className={danger ? "btn btn-danger btn-sm" : "btn btn-primary btn-sm"}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        {message}
      </p>
    </Modal>
  );
}