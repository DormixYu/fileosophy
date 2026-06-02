import { Star, X, StickyNote } from "lucide-react";
import type { FileBookmark } from "@/types";

interface Props {
  bookmarks: FileBookmark[];
  onOpen: (bookmark: FileBookmark) => void;
  onUnstar: (id: number) => void;
  onEditNote: (bookmark: FileBookmark) => void;
}

export default function FileBookmarkBar({ bookmarks, onOpen, onUnstar, onEditNote }: Props) {
  const starred = bookmarks.filter((b) => b.starred);
  if (starred.length === 0) return null;

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg overflow-x-auto"
      style={{
        background: "var(--gold-glow)",
        border: "1px solid var(--border-light)",
      }}
    >
      <Star size={14} strokeWidth={1.5} style={{ color: "var(--gold)", flexShrink: 0 }} />
      <span className="text-[11px] shrink-0" style={{ color: "var(--text-muted)" }}>
        已标记
      </span>
      {starred.map((b) => (
        <div
          key={b.id}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer transition-colors hover-gold-bg shrink-0"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-light)",
          }}
          onClick={() => onOpen(b)}
        >
          <Star size={11} fill="var(--gold)" strokeWidth={1.5} style={{ color: "var(--gold)" }} />
          <span className="text-xs truncate max-w-[120px]" style={{ color: "var(--text-primary)" }}>
            {b.file_name}
          </span>
          {b.note && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditNote(b);
              }}
              className="hover-gold-text transition-colors"
              style={{ color: "var(--text-muted)" }}
              title={b.note}
            >
              <StickyNote size={10} strokeWidth={1.5} />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUnstar(b.id);
            }}
            className="hover-danger-text transition-colors"
            style={{ color: "var(--text-muted)" }}
            title="取消标记"
          >
            <X size={10} strokeWidth={2} />
          </button>
        </div>
      ))}
    </div>
  );
}
