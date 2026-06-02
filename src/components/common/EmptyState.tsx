import type { ReactNode } from "react";

interface Props {
  icon?: ReactNode;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
      {icon && (
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
          style={{
            background: "var(--gold-glow)",
            border: "1px solid var(--gold-glow-strong)",
          }}
        >
          <span style={{ color: "var(--gold)", fontSize: "1.75rem" }}>{icon}</span>
        </div>
      )}
      {title && (
        <p
          className="text-sm font-semibold mb-1.5"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </p>
      )}
      {description && (
        <p
          className="text-xs mb-5 max-w-xs mx-auto leading-relaxed"
          style={{ color: "var(--text-muted)" }}
        >
          {description}
        </p>
      )}
      {action && (
        <button className="btn btn-primary" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
