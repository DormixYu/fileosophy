import { useState, useEffect } from "react";
import { Save, Sun, Moon, Monitor, Type } from "lucide-react";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useNotificationStore } from "@/stores/useNotificationStore";
import { DEFAULT_TEMPLATES, type ProjectTemplate } from "@/lib/templates";
import { getTemplates } from "@/lib/templates";

const THEME_OPTIONS = [
  { value: "light" as const, label: "浅色", icon: Sun },
  { value: "dark" as const, label: "深色", icon: Moon },
  { value: "system" as const, label: "跟随系统", icon: Monitor },
];

const FONT_SIZE_OPTIONS = [
  { value: "12", label: "小" },
  { value: "14", label: "标准" },
  { value: "16", label: "大" },
  { value: "18", label: "特大" },
];

export default function AppearanceSection({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) {
  const { settings, setTheme, saveSettings } = useSettingsStore();
  const { addToast } = useNotificationStore();

  const currentTheme = settings.theme || "system";
  const [fontSize, setFontSize] = useState(settings["font_size"] || "14");
  const [defaultTemplate, setDefaultTemplate] = useState(settings["default_template"] || "pj");
  const [templates, setTemplatesState] = useState<ProjectTemplate[]>(DEFAULT_TEMPLATES);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    getTemplates().then(setTemplatesState).catch(() => {});
  }, []);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const handleThemeChange = (theme: "light" | "dark" | "system") => {
    setTheme(theme);
    setDirty(true);
  };

  const handleFontSizeChange = (size: string) => {
    setFontSize(size);
    document.documentElement.style.fontSize = `${size}px`;
    setDirty(true);
  };

  const handleSave = async () => {
    await saveSettings({
      font_size: fontSize,
      default_template: defaultTemplate,
    });
    setDirty(false);
    addToast({ type: "success", title: "外观设置已保存", message: "" });
  };

  return (
    <section className="animate-slide-up">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          外观设置
        </h2>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleSave}
          disabled={!dirty}
          style={{ opacity: dirty ? 1 : 0.5 }}
        >
          <Save size={13} strokeWidth={1.5} />
          保存
        </button>
      </div>

      {/* 主题切换 */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
          主题
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              className="flex flex-col items-center gap-2 py-3.5 px-3 rounded-xl transition-all"
              style={{
                background: currentTheme === value ? "var(--gold-glow-strong)" : "var(--bg-surface-alt)",
                border: `1.5px solid ${currentTheme === value ? "var(--gold)" : "var(--border-default)"}`,
                color: currentTheme === value ? "var(--gold)" : "var(--text-secondary)",
                boxShadow: currentTheme === value ? "var(--shadow-gold)" : "none",
                cursor: "pointer",
              }}
              onClick={() => handleThemeChange(value)}
            >
              <Icon size={18} strokeWidth={1.5} />
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 字体大小 */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
          <Type size={14} strokeWidth={1.5} className="inline mr-1.5 -mt-0.5" />
          字体大小
        </h3>
        <div className="flex gap-2">
          {FONT_SIZE_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              className="px-4 py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                background: fontSize === value ? "var(--gold-glow-strong)" : "var(--bg-surface-alt)",
                border: `1.5px solid ${fontSize === value ? "var(--gold)" : "var(--border-default)"}`,
                color: fontSize === value ? "var(--gold)" : "var(--text-secondary)",
                cursor: "pointer",
              }}
              onClick={() => handleFontSizeChange(value)}
            >
              {label}
              <span className="ml-1 opacity-60">{value}px</span>
            </button>
          ))}
        </div>
      </div>

      {/* 默认模板 */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
          默认项目模板
        </h3>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
          新建项目时默认使用的模板
        </p>
        <select
          value={defaultTemplate}
          onChange={(e) => { setDefaultTemplate(e.target.value); setDirty(true); }}
          className="input-base w-full"
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.icon} {t.name} — {t.description}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
