import { useState } from "react";
import { Trash2, Target, Calendar, FileText, Folder, X, Paperclip } from "lucide-react";
import type { KanbanCard as CardType } from "@/types";
import { projectApi } from "@/lib/tauri-api";

interface Props {
  card: CardType;
  columnType?: string | null;
  onComplete?: () => void;
  onClick?: () => void;
  onDelete?: () => void;
  onRemoveFileLink?: (filePath: string) => void;
  onAddFileLink?: () => void;
  index?: number;
}

export default function KanbanCard({
  card,
  columnType,
  onComplete,
  onClick,
  onDelete,
  onRemoveFileLink,
  onAddFileLink,
  index = 0,
}: Props) {
  const isTodoPending = columnType === "todo_pending";
  const isTodoDone = columnType === "todo_done";
  const isTodo = isTodoPending || isTodoDone;

  const [completing, setCompleting] = useState(false);

  const statusColor = isTodoDone
    ? "var(--status-done)"
    : isTodoPending
      ? "var(--status-todo)"
      : "var(--gold)";

  const staggerClass = `kanban-card-stagger-${Math.min(index, 9)}`;

  const handleComplete = () => {
    if (isTodoPending && onComplete) {
      setCompleting(true);
      setTimeout(() => {
        setCompleting(false);
        onComplete();
      }, 600);
    } else if (onComplete) {
      onComplete();
    }
  };

  const handleOpenFile = async (filePath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await projectApi.openFile(filePath);
    } catch {
      // ignore
    }
  };

  const linkedFiles = card.linked_files ?? [];

  return (
    <div
      className={`flex-1 rounded-lg relative group/card animate-kanban-card ${staggerClass} ${completing ? "card-completing" : ""}`}
      style={{
        background: isTodoDone ? "var(--bg-surface)" : "var(--bg-elevated)",
        border: `1px solid ${isTodoDone ? "var(--border-default)" : "var(--border-light)"}`,
        boxShadow: "var(--shadow-sm)",
        cursor: "grab",
        transition: "all var(--duration-base) var(--ease-liquid)",
        overflow: "hidden",
        opacity: isTodoDone ? 0.75 : completing ? 0.4 : 1,
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (!completing) {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "var(--shadow-md)";
          e.currentTarget.style.borderColor = "var(--border-default)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "var(--shadow-sm)";
        e.currentTarget.style.borderColor = isTodoDone
          ? "var(--border-default)"
          : "var(--border-light)";
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.cursor = "grabbing";
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.cursor = "grab";
      }}
    >
      {/* 完成动画覆盖层 */}
      {completing && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center"
          style={{
            background: "rgba(107, 142, 90, 0.15)",
            borderRadius: "var(--radius-lg)",
            animation: "cardCompleteFade 0.6s ease-out forwards",
          }}
        >
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: 32,
              height: 32,
              background: "var(--status-done)",
              animation: "cardCompleteCheck 0.4s ease-out 0.1s both",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              style={{ animation: "cardCheckDraw 0.3s ease-out 0.2s both" }}
            >
              <path
                d="M4 9 L7.5 12.5 L14 5.5"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      )}

      {/* 状态色指示条 */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{
          background: statusColor,
          borderRadius: "var(--radius-lg) 0 0 var(--radius-lg)",
        }}
      />

      <div className="pl-3 pr-2.5 py-2.5">
        {/* 删除按钮 */}
        {onDelete && (
          <button
            className="absolute top-1.5 right-1.5 p-1 rounded-md opacity-0 group-hover/card:opacity-100 transition-opacity"
            style={{
              color: "var(--text-muted)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
            aria-label="删除卡片"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--color-danger)";
              e.currentTarget.style.background = "var(--color-danger-light)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-muted)";
              e.currentTarget.style.background = "transparent";
            }}
          >
            <Trash2 size={12} strokeWidth={1.5} />
          </button>
        )}

        {/* 甘特关联图标 */}
        {card.gantt_task_id && (
          <span
            className="absolute top-1.5 right-8"
            style={{ color: "var(--gold)" }}
            title="已关联甘特图任务"
          >
            <Target size={10} strokeWidth={1.5} />
          </span>
        )}

        <div className="flex items-start gap-2">
          {/* Todo checkbox */}
          {isTodo && onComplete && (
            <button
              className="mt-0.5 shrink-0"
              aria-label={isTodoDone ? "标记为未完成" : "标记为已完成"}
              onClick={(e) => {
                e.stopPropagation();
                handleComplete();
              }}
              style={{
                color: isTodoDone ? "var(--status-done)" : "var(--text-muted)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16">
                <circle
                  cx="8"
                  cy="8"
                  r="6.5"
                  fill={isTodoDone ? "var(--status-done)" : "transparent"}
                  stroke={isTodoDone ? "var(--status-done)" : "var(--text-muted)"}
                  strokeWidth="1.5"
                />
                {isTodoDone && (
                  <path
                    d="M5 8 L7 10 L11 5.5"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                )}
              </svg>
            </button>
          )}

          <div className="flex-1 min-w-0">
            {/* 标题 */}
            <p
              className="text-[13px] font-semibold leading-snug mb-1 pr-6"
              style={{
                color: isTodoDone ? "var(--text-dim)" : "var(--text-primary)",
                textDecoration: isTodoDone ? "line-through" : "none",
              }}
            >
              {card.title}
            </p>

            {/* 描述 */}
            {card.description && (
              <p
                className="text-[11px] leading-relaxed line-clamp-2 mb-1.5"
                style={{
                  color: isTodoDone ? "var(--text-dim)" : "var(--text-tertiary)",
                }}
              >
                {card.description}
              </p>
            )}

            {/* 关联文件列表 */}
            {linkedFiles.length > 0 && (
              <div className="mb-1.5 space-y-0.5">
                {linkedFiles.map((f) => (
                  <div
                    key={f.path}
                    className="flex items-center gap-1.5 text-[10px] px-1.5 py-0.5 rounded-md group/link cursor-pointer"
                    style={{
                      background: "var(--bg-surface-alt)",
                      color: "var(--text-secondary)",
                      transition: "all 0.15s ease",
                    }}
                    onClick={(e) => handleOpenFile(f.path, e)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--gold-glow)";
                      e.currentTarget.style.color = "var(--gold-dark)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "var(--bg-surface-alt)";
                      e.currentTarget.style.color = "var(--text-secondary)";
                    }}
                    title={f.path}
                  >
                    {f.type === "folder" ? (
                      <Folder size={10} strokeWidth={1.5} style={{ color: "var(--gold)", flexShrink: 0 }} />
                    ) : (
                      <FileText size={10} strokeWidth={1.5} style={{ color: "var(--gold)", flexShrink: 0 }} />
                    )}
                    <span className="truncate flex-1">{f.name}</span>
                    {onRemoveFileLink && (
                      <button
                        className="opacity-0 group-hover/link:opacity-100 p-0.5 -mr-1 rounded transition-opacity"
                        style={{
                          color: "var(--color-danger)",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                        aria-label="移除文件关联"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveFileLink(f.path);
                        }}
                      >
                        <X size={8} strokeWidth={2} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 元信息行：截止日期 + 标签 + 关联文件按钮 */}
            <div className="flex items-center gap-2 flex-wrap">
              {card.due_date && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md"
                  style={{
                    color: isTodoDone ? "var(--text-dim)" : "var(--text-muted)",
                    background: "var(--bg-surface-alt)",
                  }}
                >
                  <Calendar size={9} strokeWidth={1.5} />
                  {card.due_date}
                </span>
              )}
              {card.tags.length > 0 &&
                card.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{
                      background: "var(--gold-glow)",
                      color: "var(--gold-dark)",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              {onAddFileLink && (
                <button
                  className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-md opacity-0 group-hover/card:opacity-100 transition-opacity"
                  style={{
                    background: "var(--bg-surface-alt)",
                    color: "var(--text-muted)",
                    border: "none",
                    cursor: "pointer",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddFileLink();
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--gold)";
                    e.currentTarget.style.background = "var(--gold-glow)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--text-muted)";
                    e.currentTarget.style.background = "var(--bg-surface-alt)";
                  }}
                  title="关联文件"
                >
                  <Paperclip size={8} strokeWidth={1.5} />
                  关联
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
