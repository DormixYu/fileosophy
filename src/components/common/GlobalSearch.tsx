import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, FolderKanban, Columns3, ListTodo, File, Bookmark } from "lucide-react";
import Modal from "@/components/common/Modal";
import type { SearchResult } from "@/types";
import { searchApi } from "@/lib/tauri-api";

interface Props {
  open: boolean;
  onClose: () => void;
}

const typeIcons: Record<string, React.ReactNode> = {
  project: <FolderKanban size={14} strokeWidth={1.5} />,
  card: <Columns3 size={14} strokeWidth={1.5} />,
  task: <ListTodo size={14} strokeWidth={1.5} />,
  file: <File size={14} strokeWidth={1.5} />,
  bookmark: <Bookmark size={14} strokeWidth={1.5} />,
};

const typeLabels: Record<string, string> = {
  project: "项目",
  card: "卡片",
  task: "任务",
  file: "文件",
  bookmark: "标记",
};

export default function GlobalSearch({ open, onClose }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }
    setLoading(true);
    try {
      const r = await searchApi.search(q.trim());
      setResults(r);
      setSelectedIndex(0);
    } catch (e) {
      console.error("Search failed:", e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 200);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[selectedIndex];
      if (item) {
        handleResultClick(item);
      }
    }
  };

  const handleResultClick = (item: SearchResult) => {
    onClose();
    const { result_type, project_id } = item;
    if (result_type === "card") {
      navigate(`/project/${project_id}?tab=kanban`);
    } else if (result_type === "task") {
      navigate(`/project/${project_id}?tab=gantt`);
    } else if (result_type === "bookmark") {
      navigate(`/project/${project_id}?tab=files`);
    } else {
      navigate(`/project/${project_id}`);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="全局搜索" width="max-w-lg">
      <div className="space-y-4">
        {/* 搜索输入 */}
        <div className="search-input-wrapper">
          <Search
            size={15}
            strokeWidth={1.5}
            style={{ color: "var(--gold)", flexShrink: 0 }}
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索项目、卡片、任务、文件、标记..."
          />
        </div>

        {/* 搜索结果 */}
        <div className="max-h-72 overflow-y-auto -mx-1">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-xs" style={{ color: "var(--text-muted)" }}>
              <svg className="animate-spin" width={14} height={14} viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.15" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              搜索中...
            </div>
          ) : results.length === 0 && query.trim() ? (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>未找到结果</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                试试其他关键词
              </p>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-0.5">
              {results.map((item, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <button
                    key={`${item.result_type}-${item.id}`}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all"
                    style={{
                      background: isSelected ? "var(--gold-glow)" : "transparent",
                      borderLeft: isSelected ? "2px solid var(--gold)" : "2px solid transparent",
                      color: "var(--text-primary)",
                    }}
                    onClick={() => handleResultClick(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <span
                      className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                      style={{
                        background: isSelected ? "var(--gold-glow-strong)" : "var(--bg-surface-alt)",
                        color: "var(--gold)",
                      }}
                    >
                      {typeIcons[item.result_type]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.title}</p>
                      {item.result_type === "bookmark" && item.detail && (
                        <p className="text-[10px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                          {item.detail}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="badge badge-primary">
                          {typeLabels[item.result_type]}
                        </span>
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {item.project_name}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : query.trim() ? null : (
            <div className="text-center py-8">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                style={{ background: "var(--gold-glow)" }}
              >
                <Search size={20} strokeWidth={1.5} style={{ color: "var(--gold)" }} />
              </div>
              <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>输入关键词开始搜索</p>
              <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                可搜索项目名称、卡片标题与描述、甘特图任务名称、项目文件名、文件标记与备注
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}