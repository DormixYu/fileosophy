import { useState, useEffect } from "react";
import { Sun, Moon, Monitor, ArrowRight, ChevronLeft, Sparkles } from "lucide-react";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUserStore } from "@/stores/useUserStore";

const themes = [
  { key: "light" as const, label: "浅色", icon: Sun },
  { key: "dark" as const, label: "深色", icon: Moon },
  { key: "system" as const, label: "跟随系统", icon: Monitor },
];

interface OnboardingOverlayProps {
  onComplete: () => void;
}

/* ── 迷你可视化预览 ────────────────────────────────── */

function KanbanPreview() {
  const cols = [
    { title: "待办", cards: ["需求分析", "资料收集"] },
    { title: "进行中", cards: ["方案设计"] },
    { title: "完成", cards: ["评审通过"] },
  ];
  return (
    <div className="flex gap-1.5 w-full" style={{ height: 56 }}>
      {cols.map((col, ci) => (
        <div
          key={col.title}
          className="flex-1 flex flex-col gap-0.5 rounded p-1"
          style={{ background: "var(--bg-void)", border: "1px solid var(--border-light)" }}
        >
          <div className="text-[6px] text-center" style={{ color: ci === 2 ? "var(--gold)" : "var(--text-muted)" }}>
            {col.title}
          </div>
          {col.cards.map((card) => (
            <div
              key={card}
              className="rounded px-1 py-px"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-light)", minHeight: 11 }}
            >
              <div className="text-[5px]" style={{ color: "var(--text-secondary)" }}>{card}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function GanttPreview() {
  const tasks = [
    { name: "调研", start: 0, width: 28, color: "var(--gold)" },
    { name: "开发", start: 18, width: 45, color: "var(--text-muted)" },
    { name: "交付", start: 55, width: 35, color: "var(--gold)" },
  ];
  return (
    <div className="w-full flex flex-col gap-1" style={{ height: 56 }}>
      {tasks.map((task) => (
        <div key={task.name} className="flex items-center gap-1.5">
          <div className="text-[6px] w-8 shrink-0" style={{ color: "var(--text-secondary)" }}>{task.name}</div>
          <div className="flex-1 relative h-2.5 rounded" style={{ background: "var(--bg-void)" }}>
            <div className="absolute h-2.5 rounded" style={{ left: `${task.start}%`, width: `${task.width}%`, background: task.color, opacity: 0.6 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function FilePreview() {
  const rows = [
    { icon: "\u{1F4C1}", name: "项目根目录", indent: 0, color: "var(--gold)" },
    { icon: "\u{1F4C1}", name: "文档资料", indent: 1, color: "var(--gold)" },
    { icon: "\u{1F4C4}", name: "报告.docx", indent: 2, color: "var(--text-muted)" },
    { icon: "\u{1F4C1}", name: "设计稿", indent: 1, color: "var(--gold)" },
  ];
  return (
    <div className="flex flex-col gap-0.5 w-full" style={{ height: 56 }}>
      {rows.map((row) => (
        <div key={row.name} className="flex items-center gap-1" style={{ marginLeft: row.indent * 10 }}>
          <span className="text-[7px]" style={{ color: row.color }}>{row.icon}</span>
          <span className="text-[6px] truncate" style={{ color: row.indent === 0 ? "var(--text-primary)" : "var(--text-secondary)" }}>
            {row.name}
          </span>
        </div>
      ))}
    </div>
  );
}

function SharePreview() {
  return (
    <div className="flex items-center justify-center gap-4 w-full" style={{ height: 56 }}>
      <div
        className="w-8 h-8 rounded-md flex items-center justify-center"
        style={{ background: "var(--gold-glow)", border: "1px solid var(--gold)" }}
      >
        <span className="text-[7px]" style={{ color: "var(--gold)" }}>本机</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-4 h-px" style={{ background: "var(--gold)", opacity: 0.5 }} />
        <span className="text-[7px]" style={{ color: "var(--gold)" }}>mDNS</span>
        <div className="w-4 h-px" style={{ background: "var(--gold)", opacity: 0.5 }} />
      </div>
      <div
        className="w-8 h-8 rounded-md flex items-center justify-center"
        style={{ background: "var(--bg-void)", border: "1px solid var(--border-default)" }}
      >
        <span className="text-[7px]" style={{ color: "var(--text-secondary)" }}>同事</span>
      </div>
    </div>
  );
}

const featureItems = [
  { label: "看板管理", desc: "拖拽卡片追踪任务状态", Preview: KanbanPreview },
  { label: "甘特图", desc: "时间线可视化项目进度", Preview: GanttPreview },
  { label: "文件管理", desc: "目录树浏览与文件共享", Preview: FilePreview },
  { label: "局域网协作", desc: "发现同网段同事，分享文件夹", Preview: SharePreview },
];

const workflowSteps = [
  { num: "1", title: "创建项目", desc: "点击项目页「新建」，填写名称和描述" },
  { num: "2", title: "看板管理", desc: "在看板中添加列和卡片，拖拽排序追踪进度" },
  { num: "3", title: "甘特追踪", desc: "创建甘特图任务，设置日期和依赖关系" },
  { num: "4", title: "文件协作", desc: "关联项目文件夹，或局域网分享给同事" },
];

const shortcuts = [
  { key: "Ctrl+Shift+N", desc: "快速新建项目" },
  { key: "Ctrl+Shift+F", desc: "全局搜索" },
  { key: "Ctrl+Shift+S", desc: "显示/隐藏窗口" },
];

export default function OnboardingOverlay({ onComplete }: OnboardingOverlayProps) {
  const [step, setStep] = useState(0);
  const [userName, setUserName] = useState("");
  const { settings, setTheme, saveSettings } = useSettingsStore();
  const { user, saveUser } = useUserStore();

  const totalSteps = 5;

  useEffect(() => {
    if (user?.name) setUserName(user.name);
  }, [user]);

  const goNext = () => {
    if (step < totalSteps - 1) setStep(step + 1);
  };
  const goPrev = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleFinish = async () => {
    if (userName.trim()) {
      try { await saveUser(userName.trim()); } catch { /* ignore */ }
    }
    try { await saveSettings({ tutorial_completed: "true" }); } catch { /* ignore */ }
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div
        className="absolute inset-0 opacity-[0.018]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative w-full max-w-lg px-8 py-6">
        {/* 进度条 */}
        <div className="flex items-center gap-2 justify-center mb-6">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className="h-1 rounded-full transition-all duration-500"
              style={{
                width: i === step ? 24 : 8,
                background: i <= step ? "var(--gold)" : "var(--border-default)",
              }}
            />
          ))}
        </div>

        {/* 步骤内容 */}
        <div key={step} className="animate-slide-up">
          {/* ── Step 0: 欢迎 ── */}
          {step === 0 && (
            <div className="text-center space-y-5">
              <div className="flex justify-center">
                <svg
                  viewBox="0 0 100 100"
                  width="72"
                  height="72"
                  fill="none"
                  className="animate-scale-in"
                  style={{ color: "var(--text-primary)" }}
                >
                  <path d="M26,8 L64,8 L82,26 L82,92 L26,92 Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  <path d="M64,8 L64,26 L82,26" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
                  <line x1="36" y1="36" x2="56" y2="36" stroke="currentColor" strokeWidth="1" opacity="0.25" strokeLinecap="round" />
                  <line x1="36" y1="78" x2="54" y2="78" stroke="currentColor" strokeWidth="1" opacity="0.25" strokeLinecap="round" />
                  <line x1="36" y1="86" x2="46" y2="86" stroke="currentColor" strokeWidth="1" opacity="0.25" strokeLinecap="round" />
                  <path
                    d="M34,57 C40,36 52,36 52,53 C52,70 64,70 66,50"
                    stroke="var(--gold)"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    style={{ filter: "drop-shadow(0 0 6px rgba(201,168,76,0.35))" }}
                  />
                </svg>
              </div>
              <h1 className="text-2xl animate-fade-in" style={{ color: "var(--text-primary)" }}>
                飞序 · Fileosophy
              </h1>
              <p className="text-sm animate-fade-in" style={{ color: "var(--text-secondary)" }}>
                在有序的体系中迸发思想的自由
              </p>
              <p className="text-xs animate-fade-in" style={{ color: "var(--text-muted)", animationDelay: "0.3s" }}>
                看板、甘特图、文件共享、局域网协作
              </p>
            </div>
          )}

          {/* ── Step 1: 主题 ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="text-center">
                <h2 className="text-lg" style={{ color: "var(--text-primary)" }}>选择你的风格</h2>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>随时可以在设置中更改</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {themes.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setTheme(key)}
                    className="card flex flex-col items-center gap-3 py-5 transition-all"
                    style={{
                      borderColor: settings.theme === key ? "var(--gold)" : "var(--border-default)",
                      boxShadow: settings.theme === key ? "var(--shadow-gold)" : "none",
                      cursor: "pointer",
                      background: "var(--bg-surface)",
                    }}
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{
                        background: key === "light" ? "#f6f1e6" : key === "dark" ? "#16120e" : "linear-gradient(135deg, #16120e 50%, #f6f1e6 50%)",
                        border: "1px solid var(--border-light)",
                      }}
                    >
                      <Icon size={20} strokeWidth={1.5} style={{ color: settings.theme === key ? "var(--gold)" : "var(--text-tertiary)" }} />
                    </div>
                    <span className="text-xs" style={{ color: settings.theme === key ? "var(--gold)" : "var(--text-secondary)" }}>
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 2: 用户名 ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="text-center">
                <h2 className="text-lg" style={{ color: "var(--text-primary)" }}>你是谁？</h2>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>方便团队成员识别你</p>
              </div>
              <div className="flex justify-center">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: "var(--gold-glow)", border: "2px solid var(--gold)" }}
                >
                  <Sparkles size={24} strokeWidth={1.5} style={{ color: "var(--gold)" }} />
                </div>
              </div>
              <div className="max-w-xs mx-auto">
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="输入你的名字"
                  autoFocus
                  className="input-base w-full text-center text-sm"
                  onKeyDown={(e) => e.key === "Enter" && goNext()}
                  maxLength={20}
                />
              </div>
            </div>
          )}

          {/* ── Step 3: 功能演示（2×2 网格） ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-lg" style={{ color: "var(--text-primary)" }}>核心功能</h2>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>四大能力，覆盖项目管理全流程</p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {featureItems.map(({ label, desc, Preview }, i) => (
                  <div
                    key={i}
                    className="rounded-lg p-2.5 animate-fade-in"
                    style={{
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-light)",
                      animationDelay: `${i * 0.08}s`,
                    }}
                  >
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-[11px]" style={{ color: "var(--gold)" }}>{label}</span>
                      <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>{desc}</span>
                    </div>
                    <Preview />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 4: 快速上手（2列布局 + 内联快捷键） ── */}
          {step === 4 && (
            <div className="space-y-3">
              <div className="text-center">
                <h2 className="text-lg" style={{ color: "var(--text-primary)" }}>快速上手</h2>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>四步开始你的第一个项目</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {workflowSteps.map(({ num, title, desc }) => (
                  <div
                    key={num}
                    className="flex items-start gap-2 px-2.5 py-2 rounded-lg"
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)" }}
                  >
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center shrink-0 text-[9px]"
                      style={{ background: "var(--gold-glow)", color: "var(--gold)", border: "1px solid var(--gold)" }}
                    >
                      {num}
                    </div>
                    <div>
                      <span className="text-[11px]" style={{ color: "var(--text-primary)" }}>{title}</span>
                      <p className="text-[9px] mt-0.5 leading-snug" style={{ color: "var(--text-muted)" }}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-2" style={{ borderTop: "1px solid var(--border-light)" }}>
                <p className="text-[8px] uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>
                  快捷键
                </p>
                <div className="flex gap-3">
                  {shortcuts.map(({ key, desc }) => (
                    <div key={key} className="flex items-center gap-1">
                      <span className="text-[9px]" style={{ color: "var(--text-secondary)" }}>{desc}</span>
                      <span
                        className="text-[9px] px-1 py-px rounded"
                        style={{ background: "var(--bg-surface)", border: "1px solid var(--border-light)", color: "var(--gold)" }}
                      >
                        {key}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 导航按钮 */}
        <div className="flex items-center justify-between mt-6">
          {step > 0 ? (
            <button className="btn btn-ghost btn-sm flex items-center gap-1" onClick={goPrev}>
              <ChevronLeft size={14} strokeWidth={1.5} />
              上一步
            </button>
          ) : (
            <span />
          )}

          {step < totalSteps - 1 ? (
            <button className="btn btn-primary btn-sm flex items-center gap-1" onClick={goNext}>
              下一步
              <ArrowRight size={14} strokeWidth={1.5} />
            </button>
          ) : (
            <button className="btn btn-primary btn-sm flex items-center gap-1" onClick={handleFinish}>
              开始使用
              <Sparkles size={14} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}