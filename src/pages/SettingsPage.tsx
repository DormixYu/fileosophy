import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Info,
  Keyboard,
  Database,
  User as UserIcon,
  Bell,
  Settings2,
  Palette,
} from "lucide-react";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { ConfirmDialog } from "@/components/common/Modal";
import ProfileSection from "@/components/settings/ProfileSection";
import AboutSection from "@/components/settings/AboutSection";
import NotificationSection from "@/components/settings/NotificationSection";
import ShortcutsSection from "@/components/settings/ShortcutsSection";
import DataSection from "@/components/settings/DataSection";
import ProjectConfigSection from "@/components/settings/ProjectConfigSection";
import AppearanceSection from "@/components/settings/AppearanceSection";

type TabKey = "profile" | "appearance" | "notifications" | "project" | "shortcuts" | "data" | "about";

const tabs: { key: TabKey; label: string; icon: typeof Info }[] = [
  { key: "profile", label: "用户资料", icon: UserIcon },
  { key: "appearance", label: "外观", icon: Palette },
  { key: "notifications", label: "通知", icon: Bell },
  { key: "project", label: "项目配置", icon: Settings2 },
  { key: "shortcuts", label: "快捷键", icon: Keyboard },
  { key: "data", label: "数据管理", icon: Database },
  { key: "about", label: "关于", icon: Info },
];

export default function SettingsPage() {
  const [searchParams] = useSearchParams();
  const validTabs: TabKey[] = ["profile", "appearance", "notifications", "project", "shortcuts", "data", "about"];
  const initialTab = validTabs.includes(searchParams.get("tab") as TabKey) ? (searchParams.get("tab") as TabKey) : "profile";
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [dirtyTabs, setDirtyTabs] = useState<Record<TabKey, boolean>>({
    profile: false, appearance: false, notifications: false,
    project: false, shortcuts: false, data: false, about: false,
  });
  const { fetchShortcuts } = useSettingsStore();

  // 确认弹窗状态
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingTab, setPendingTab] = useState<TabKey | null>(null);

  const handleTabChange = (key: TabKey) => {
    if (dirtyTabs[activeTab]) {
      setPendingTab(key);
      setConfirmOpen(true);
      return;
    }
    setActiveTab(key);
  };

  const handleConfirmSwitch = () => {
    if (pendingTab) {
      setActiveTab(pendingTab);
      setPendingTab(null);
    }
  };

  const handleDirtyChange = useCallback((tab: TabKey, dirty: boolean) => {
    setDirtyTabs((prev) => prev[tab] === dirty ? prev : { ...prev, [tab]: dirty });
  }, []);

  useEffect(() => {
    fetchShortcuts();
  }, [fetchShortcuts]);

  return (
    <div className="p-8 max-w-2xl animate-slide-up">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-title" style={{ color: "var(--text-primary)" }}>
          设置
        </h1>
      </div>

      {/* 标签栏 */}
      <div className="tab-group mb-8">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            className={`tab-item flex-1 justify-center ${activeTab === key ? "active" : ""}`}
          >
            <Icon size={14} strokeWidth={1.5} />
            {label}
            {dirtyTabs[key] && (
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: "var(--gold)" }}
              />
            )}
          </button>
        ))}
      </div>

      {/* 标签内容 */}
      {activeTab === "profile" && <ProfileSection onDirtyChange={(d) => handleDirtyChange("profile", d)} />}
      {activeTab === "appearance" && <AppearanceSection onDirtyChange={(d) => handleDirtyChange("appearance", d)} />}
      {activeTab === "notifications" && <NotificationSection onDirtyChange={(d) => handleDirtyChange("notifications", d)} />}
      {activeTab === "project" && <ProjectConfigSection onDirtyChange={(d) => handleDirtyChange("project", d)} />}
      {activeTab === "shortcuts" && <ShortcutsSection onDirtyChange={(d) => handleDirtyChange("shortcuts", d)} />}
      {activeTab === "data" && <DataSection />}
      {activeTab === "about" && <AboutSection />}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmSwitch}
        title="未保存的修改"
        message="当前页有未保存的修改，是否放弃修改并切换？"
        confirmLabel="放弃并切换"
        danger
      />
    </div>
  );
}