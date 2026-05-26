import { useState, useEffect, useCallback } from "react";
import {
  Share2, Plus, Copy, StopCircle, FolderOpen, RefreshCw, Unplug,
  Upload, Download, Clock, Users, Activity, Wifi, WifiOff, Link,
} from "lucide-react";
import { useShareStore } from "@/stores/useShareStore";
import { useProjectStore } from "@/stores/useProjectStore";
import { useNotificationStore } from "@/stores/useNotificationStore";
import RemoteFileBrowser from "@/components/sharing/RemoteFileBrowser";
import { normalizePath } from "@/components/sharing/ActiveShareRow";
import { formatTimeFull } from "@/lib/formatUtils";
import type { SharedConnection, SharedProject, Peer, Project } from "@/types";
import { open } from "@tauri-apps/plugin-dialog";
import { shareApi } from "@/lib/tauri-api";

export default function SharingPage() {
  const {
    shareStatus, localIp, savedConnections, sharedProjects, peers,
    fetchShareStatus, fetchConnections, fetchSharedProjects, fetchPeers, fetchLocalIp,
    startShare, stopShare, addConnection, removeConnection, reconnect,
    syncProject, disconnectProject, importProject,
  } = useShareStore();
  const { projects, fetchProjects } = useProjectStore();
  const { addToast } = useNotificationStore();

  // 新建共享表单
  const [showNewShare, setShowNewShare] = useState(false);
  const [newSharePath, setNewSharePath] = useState("");
  const [newSharePassword, setNewSharePassword] = useState("");
  const [newShareLoading, setNewShareLoading] = useState(false);

  // 新建连接表单
  const [showNewConn, setShowNewConn] = useState(false);
  const [newConnAddr, setNewConnAddr] = useState("");
  const [newConnPassword, setNewConnPassword] = useState("");
  const [newConnLabel, setNewConnLabel] = useState("");
  const [newConnLoading, setNewConnLoading] = useState(false);

  // 远程文件浏览器
  const [browsingConn, setBrowsingConn] = useState<SharedConnection | null>(null);

  useEffect(() => {
    fetchShareStatus();
    fetchConnections();
    fetchSharedProjects();
    fetchPeers();
    fetchLocalIp();
  }, [fetchShareStatus, fetchConnections, fetchSharedProjects, fetchPeers, fetchLocalIp]);

  // 复制文本到剪贴板
  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    addToast({ type: "success", title: "已复制", message: text });
  }, [addToast]);

  // 发起共享
  const handleStartShare = async () => {
    if (!newSharePath || newSharePassword.length < 4) return;
    setNewShareLoading(true);
    try {
      const port = await startShare(newSharePath, newSharePassword);
      addToast({ type: "success", title: "共享已开启", message: `端口: ${port}` });
      setShowNewShare(false);
      setNewSharePath("");
      setNewSharePassword("");
    } catch (e) {
      addToast({ type: "error", title: "共享失败", message: String(e) });
    } finally {
      setNewShareLoading(false);
    }
  };

  // 选择文件夹
  const handleSelectFolder = async () => {
    const selected = await open({ directory: true });
    if (selected) setNewSharePath(selected as string);
  };

  // 连接新共享
  const handleConnect = async () => {
    if (!newConnAddr || !newConnPassword) return;
    setNewConnLoading(true);
    try {
      await addConnection(newConnAddr, newConnPassword, newConnLabel || undefined);
      addToast({ type: "success", title: "连接成功", message: newConnAddr });
      setShowNewConn(false);
      setNewConnAddr("");
      setNewConnPassword("");
      setNewConnLabel("");
    } catch (e) {
      addToast({ type: "error", title: "连接失败", message: String(e) });
    } finally {
      setNewConnLoading(false);
    }
  };

  // 一键连接（从局域网设备列表）
  const handleQuickConnect = (peer: Peer) => {
    if (peer.share_port) {
      const addr = `${peer.addresses[0]}:${peer.share_port}`;
      setNewConnAddr(addr);
      setShowNewConn(true);
    }
  };

  // 匹配共享与项目
  const matchProject = (path: string) =>
    projects.find((p) => p.folder_path && normalizePath(p.folder_path) === normalizePath(path)) as (typeof projects[0] | undefined);

  // owner 共享列表（本机发起的）
  const ownerShares = shareStatus.map((s) => ({
    ...s,
    project: matchProject(s.path),
  }));

  // member 共享列表（加入他人的）
  const memberShares = sharedProjects.filter((sp) => sp.role === "member");

  return (
    <div className="h-full flex flex-col animate-slide-up">
      {/* 顶部操作栏 */}
      <div
        className="shrink-0 px-6 py-4 border-b"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border-light)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-title" style={{ color: "var(--text-primary)" }}>局域网共享</h1>
          <div className="flex items-center gap-3">
            {/* 本机 IP */}
            {localIp && (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                本机: <span className="text-gold">{localIp}</span>
              </span>
            )}
            {/* 新建共享按钮 */}
            <button className="btn btn-primary btn-sm" onClick={() => setShowNewShare(!showNewShare)}>
              <Plus size={14} strokeWidth={1.5} />
              新建共享
            </button>
          </div>
        </div>

        {/* 局域网设备快速发现 */}
        {peers.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>局域网设备:</span>
            {peers.map((peer) => (
              <button
                key={peer.name}
                className={`text-xs px-2 py-1 rounded-md transition-all ${
                  peer.share_port
                    ? "bg-gold/10 text-gold hover:bg-gold/20 cursor-pointer"
                    : "opacity-40 cursor-default"
                }`}
                style={{ border: "1px solid var(--border-light)" }}
                onClick={() => handleQuickConnect(peer)}
                disabled={!peer.share_port}
                title={peer.share_port ? `点击连接 ${peer.host}:${peer.share_port}` : "该设备未共享文件夹"}
              >
                {peer.share_port ? <Wifi size={10} className="inline mr-1" /> : <WifiOff size={10} className="inline mr-1" />}
                {peer.host}
                {peer.share_port && <span className="ml-1 text-gold">:{peer.share_port}</span>}
              </button>
            ))}
          </div>
        )}

        {/* 新建共享表单 */}
        {showNewShare && (
          <div className="mt-3 p-3 rounded-lg" style={{ background: "var(--bg-surface-alt)", border: "1px solid var(--border-light)" }}>
            <div className="flex items-center gap-3">
              <button className="btn btn-ghost btn-sm" onClick={handleSelectFolder}>
                <FolderOpen size={14} strokeWidth={1.5} />
                选择文件夹
              </button>
              {newSharePath && (
                <span className="text-xs truncate max-w-xs" style={{ color: "var(--text-secondary)" }}>
                  {newSharePath}
                </span>
              )}
              <input
                type="password"
                value={newSharePassword}
                onChange={(e) => setNewSharePassword(e.target.value)}
                placeholder="设置密码（至少4位）"
                className="input-base w-40 text-xs"
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={handleStartShare}
                disabled={!newSharePath || newSharePassword.length < 4 || newShareLoading}
              >
                {newShareLoading ? "启动中..." : "开始共享"}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowNewShare(false)}>取消</button>
            </div>
          </div>
        )}

        {/* 新建连接表单 */}
        {showNewConn && (
          <div className="mt-3 p-3 rounded-lg" style={{ background: "var(--bg-surface-alt)", border: "1px solid var(--border-light)" }}>
            <div className="flex items-center gap-3">
              <input
                value={newConnAddr}
                onChange={(e) => setNewConnAddr(e.target.value)}
                placeholder="IP:端口"
                className="input-base w-36 text-xs"
              />
              <input
                type="password"
                value={newConnPassword}
                onChange={(e) => setNewConnPassword(e.target.value)}
                placeholder="密码"
                className="input-base w-28 text-xs"
              />
              <input
                value={newConnLabel}
                onChange={(e) => setNewConnLabel(e.target.value)}
                placeholder="名称（可选）"
                className="input-base w-28 text-xs"
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={handleConnect}
                disabled={!newConnAddr || !newConnPassword || newConnLoading}
              >
                {newConnLoading ? "连接中..." : "连接"}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowNewConn(false)}>取消</button>
            </div>
          </div>
        )}
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">

        {/* ── 区域一：我发起的共享 ── */}
        <section>
          <h2 className="text-sm font-medium mb-3" style={{ color: "var(--text-secondary)" }}>
            我发起的共享
          </h2>
          {ownerShares.length === 0 ? (
            <div className="text-center py-8" style={{ color: "var(--text-muted)" }}>
              <Share2 size={32} strokeWidth={1} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">暂无共享，点击上方"新建共享"开始</p>
            </div>
          ) : (
            <div className="space-y-3">
              {ownerShares.map(({ port, path, project }) => (
                <OwnerShareCard
                  key={port}
                  port={port}
                  path={path}
                  project={project}
                  localIp={localIp}
                  onCopy={copyToClipboard}
                  onStop={() => {
                    stopShare(port);
                    addToast({ type: "info", title: "共享已停止", message: path });
                  }}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── 区域二：我加入的共享 ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              我加入的共享
            </h2>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowNewConn(!showNewConn)}>
              <Link size={12} strokeWidth={1.5} />
              连接新共享
            </button>
          </div>

          {/* 已保存的连接 */}
          {savedConnections.length > 0 && (
            <div className="space-y-2 mb-4">
              {savedConnections.map((conn) => (
                <SavedConnectionCard
                  key={conn.addr}
                  conn={conn}
                  sharedProject={memberShares.find((sp) => sp.remote_addr === conn.addr)}
                  onBrowse={() => setBrowsingConn(conn)}
                  onReconnect={async () => {
                    const ok = await reconnect(conn.addr);
                    addToast(ok
                      ? { type: "success", title: "重连成功", message: conn.label }
                      : { type: "error", title: "重连失败", message: "无法连接" }
                    );
                  }}
                  onDisconnect={async () => {
                    await removeConnection(conn.addr);
                    addToast({ type: "info", title: "已断开", message: conn.label });
                  }}
                  onSync={async (spId) => {
                    await syncProject(spId);
                    addToast({ type: "success", title: "同步完成", message: conn.label });
                  }}
                  onImport={async () => {
                    try {
                      const password = conn.password ?? await shareApi.getConnectionPassword(conn.addr);
                      await importProject(conn.addr, password, "");
                      await fetchProjects();
                      addToast({ type: "success", title: "已导入到看板", message: conn.label });
                    } catch (e) {
                      addToast({ type: "error", title: "导入失败", message: String(e) });
                    }
                  }}
                  onDisconnectProject={async (spId, del) => {
                    await disconnectProject(spId, del);
                    addToast({ type: "info", title: "已断开共享", message: conn.label });
                  }}
                />
              ))}
            </div>
          )}

          {savedConnections.length === 0 && memberShares.length === 0 && (
            <div className="text-center py-8" style={{ color: "var(--text-muted)" }}>
              <Link size={32} strokeWidth={1} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">暂无连接，点击"连接新共享"或从上方局域网设备列表选择</p>
            </div>
          )}
        </section>
      </div>

      {/* 远程文件浏览器弹窗 */}
      {browsingConn && (
        <RemoteFileBrowser conn={browsingConn} onClose={() => setBrowsingConn(null)} />
      )}
    </div>
  );
}

// ── Owner 共享卡片 ──────────────────────────────────────────────

function OwnerShareCard({
  port, path, project, localIp, onCopy, onStop,
}: {
  port: number;
  path: string;
  project?: Project;
  localIp: string;
  onCopy: (text: string) => void;
  onStop: () => void;
}) {
  const [showActivity, setShowActivity] = useState(false);
  const { connectedClients, activityLog, fetchConnectedClients, fetchActivityLog } = useShareStore();

  // 轮询
  useEffect(() => {
    const timer = setInterval(() => {
      fetchConnectedClients(port);
      fetchActivityLog(port);
    }, 5000);
    return () => clearInterval(timer);
  }, [port, fetchConnectedClients, fetchActivityLog]);

  const addr = `${localIp}:${port}`;

  return (
    <div className="card p-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {project ? (
            <a href={`/project/${project.id}`} className="text-sm font-medium truncate hover:underline text-gold">
              {project.name}
            </a>
          ) : (
            <span className="text-sm truncate" style={{ color: "var(--text-primary)" }}>{path}</span>
          )}
          {project?.status && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--gold-glow)", color: "var(--accent)" }}>
              {project.status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gold font-mono">{addr}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => onCopy(addr)}>
            <Copy size={12} strokeWidth={1.5} />
          </button>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            <Users size={10} className="inline mr-1" />
            {connectedClients.length} 人
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowActivity(!showActivity)}>
            <Activity size={12} strokeWidth={1.5} />
          </button>
          <button className="btn btn-ghost btn-sm hover-danger-text" onClick={onStop}>
            <StopCircle size={12} strokeWidth={1.5} />
            停止
          </button>
        </div>
      </div>

      {/* 活动日志 */}
      {showActivity && activityLog.length > 0 && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--border-light)" }}>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {activityLog.slice(-10).reverse().map((log, i) => (
              <div key={i} className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                {log.action === "download"
                  ? <Download size={10} className="text-gold" />
                  : <Upload size={10} className="text-green-400" />
                }
                <span className="font-mono">{log.client_addr}</span>
                <span className="truncate">{log.file_path}</span>
                <span className="ml-auto shrink-0">{formatTimeFull(log.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 已保存连接卡片 ──────────────────────────────────────────────

function SavedConnectionCard({
  conn, sharedProject, onBrowse, onReconnect, onDisconnect,
  onSync, onImport, onDisconnectProject,
}: {
  conn: SharedConnection;
  sharedProject?: SharedProject;
  onBrowse: () => void;
  onReconnect: () => void;
  onDisconnect: () => void;
  onSync: (id: number) => void;
  onImport: () => void;
  onDisconnectProject: (id: number, deleteLocal: boolean) => void;
}) {
  const isImported = !!sharedProject?.local_project_id;

  return (
    <div className="card p-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
            {conn.label}
          </span>
          <span className="text-xs text-gold font-mono">{conn.addr}</span>
          {sharedProject && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              sharedProject.status === "connected"
                ? "bg-green-500/10 text-green-400"
                : "bg-red-500/10 text-red-400"
            }`}>
              {sharedProject.status === "connected" ? "已连接" : "已断开"}
            </span>
          )}
          {sharedProject?.remote_owner && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              来自 {sharedProject.remote_owner}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {conn.last_connected && (
            <span className="text-xs mr-2" style={{ color: "var(--text-muted)" }}>
              <Clock size={10} className="inline mr-1" />
              {formatTimeFull(conn.last_connected)}
            </span>
          )}
          <button className="btn btn-ghost btn-sm" onClick={onBrowse}>
            <FolderOpen size={12} strokeWidth={1.5} />
            浏览
          </button>
          {!isImported && (
            <button className="btn btn-primary btn-sm" onClick={onImport}>
              <Download size={12} strokeWidth={1.5} />
              导入到看板
            </button>
          )}
          {sharedProject && isImported && (
            <button className="btn btn-ghost btn-sm" onClick={() => onSync(sharedProject.id)}>
              <RefreshCw size={12} strokeWidth={1.5} />
              同步
            </button>
          )}
          {sharedProject && isImported && (
            <button
              className="btn btn-ghost btn-sm hover-danger-text"
              onClick={() => onDisconnectProject(sharedProject.id, false)}
            >
              <Unplug size={12} strokeWidth={1.5} />
              取消导入
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={onReconnect}>
            <RefreshCw size={12} strokeWidth={1.5} />
            重连
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onDisconnect}>
            <Unplug size={12} strokeWidth={1.5} />
            断开
          </button>
        </div>
      </div>
    </div>
  );
}
