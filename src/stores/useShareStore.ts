import { create } from "zustand";
import { shareApi, fileApi, systemApi } from "@/lib/tauri-api";
import type { SharedConnection, SharedProject, Peer, ClientInfo, RemoteDirEntry, ActivityLogEntry } from "@/types";

interface ShareState {
  shareStatus: { port: number; path: string }[];
  localIp: string;
  savedConnections: SharedConnection[];
  sharedProjects: SharedProject[];
  peers: Peer[];
  connectedClients: ClientInfo[];
  activityLog: ActivityLogEntry[];

  fetchShareStatus: () => Promise<void>;
  startShare: (path: string, password: string) => Promise<number>;
  stopShare: (port: number) => Promise<void>;

  fetchConnections: () => Promise<void>;
  addConnection: (addr: string, password: string, label?: string) => Promise<void>;
  removeConnection: (addr: string) => Promise<void>;
  reconnect: (addr: string) => Promise<boolean>;
  updateLastPath: (addr: string, path: string) => Promise<void>;
  testConnection: (addr: string, password: string) => Promise<boolean>;

  fetchSharedProjects: () => Promise<void>;
  importProject: (addr: string, password: string, rootPath: string) => Promise<number>;
  syncProject: (id: number) => Promise<void>;
  disconnectProject: (id: number, deleteLocal: boolean) => Promise<void>;

  fetchPeers: () => Promise<void>;
  fetchLocalIp: () => Promise<void>;
  fetchConnectedClients: (port: number) => Promise<void>;
  fetchActivityLog: (port: number) => Promise<void>;
  uploadRemote: (addr: string, password: string, remoteDir: string, fileName: string, localPath: string) => Promise<void>;
}

export const useShareStore = create<ShareState>((set, get) => ({
  shareStatus: [],
  localIp: "",
  savedConnections: [],
  sharedProjects: [],
  peers: [],
  connectedClients: [],
  activityLog: [],

  fetchShareStatus: async () => {
    try {
      const status = await shareApi.getStatus();
      set({ shareStatus: status });
    } catch (e) {
      console.error("获取分享状态失败:", e);
    }
  },

  startShare: async (path: string, password: string) => {
    const port = await shareApi.start(path, password);
    await get().fetchShareStatus();
    return port;
  },

  stopShare: async (port: number) => {
    await shareApi.stop(port);
    await get().fetchShareStatus();
    set({ connectedClients: [], activityLog: [] });
  },

  fetchConnections: async () => {
    try {
      // 首次启动时尝试迁移旧数据
      try {
        await shareApi.migrateLegacy();
      } catch {
        // 迁移失败不影响后续流程
      }
      const connections = await shareApi.getConnections();
      set({ savedConnections: connections });
    } catch (e) {
      console.error("获取共享连接失败:", e);
      set({ savedConnections: [] });
    }
  },

  addConnection: async (addr: string, password: string, label?: string) => {
    await shareApi.join(addr, password);

    // 尝试获取根目录名优化 label
    let finalLabel = label || addr;
    try {
      const entries = await shareApi.listRemote(addr, password, "");
      const firstDir = entries.find((e: RemoteDirEntry) => e.is_dir);
      if (firstDir && !label) {
        finalLabel = firstDir.name;
      }
    } catch {
      // 获取失败不影响连接流程
    }

    await shareApi.saveConnection(addr, password, finalLabel);
    await get().fetchConnections();
  },

  removeConnection: async (addr: string) => {
    try {
      await shareApi.deleteConnection(addr);
    } catch {
      // 如果后端删除失败（比如连接不存在），仍然从本地移除
    }
    set({ savedConnections: get().savedConnections.filter((c) => c.addr !== addr) });
  },

  reconnect: async (addr: string) => {
    const conn = get().savedConnections.find((c) => c.addr === addr);
    if (!conn) return false;

    try {
      const password = conn.password ?? await shareApi.getConnectionPassword(addr);
      await shareApi.join(addr, password);
      await shareApi.updateConnection(addr);
      // 更新本地状态
      set({
        savedConnections: get().savedConnections.map((c) =>
          c.addr === addr ? { ...c, last_connected: new Date().toISOString() } : c
        ),
      });
      return true;
    } catch {
      return false;
    }
  },

  updateLastPath: async (addr: string, path: string) => {
    try {
      await shareApi.updateConnection(addr, path);
    } catch {
      // 忽略更新失败
    }
    set({
      savedConnections: get().savedConnections.map((c) =>
        c.addr === addr ? { ...c, last_path: path } : c
      ),
    });
  },

  testConnection: async (addr: string, password: string) => {
    try {
      return await shareApi.testConnection(addr, password);
    } catch {
      return false;
    }
  },

  fetchSharedProjects: async () => {
    try {
      const projects = await shareApi.getSharedProjects();
      set({ sharedProjects: projects });
    } catch (e) {
      console.error("获取共享项目失败:", e);
    }
  },

  importProject: async (addr: string, password: string, rootPath: string) => {
    const projectId = await shareApi.importProject(addr, password, rootPath);
    await get().fetchSharedProjects();
    return projectId;
  },

  syncProject: async (id: number) => {
    await shareApi.syncProject(id);
    await get().fetchSharedProjects();
  },

  disconnectProject: async (id: number, deleteLocal: boolean) => {
    await shareApi.disconnectProject(id, deleteLocal);
    await get().fetchSharedProjects();
  },

  fetchPeers: async () => {
    try {
      const peers = await fileApi.discoverPeers();
      set({ peers });
    } catch (e) {
      console.error("发现对等节点失败:", e);
    }
  },

  fetchLocalIp: async () => {
    try {
      const ip = await systemApi.localIp();
      set({ localIp: ip });
    } catch (e) {
      console.error("获取本机IP失败:", e);
    }
  },

  fetchConnectedClients: async (port: number) => {
    try {
      const clients = await shareApi.getConnectedClients(port);
      set({ connectedClients: clients });
    } catch (e) {
      console.error("获取连接客户端失败:", e);
    }
  },

  fetchActivityLog: async (port: number) => {
    try {
      const log = await shareApi.getActivityLog(port);
      set({ activityLog: log });
    } catch (e) {
      console.error("获取活动日志失败:", e);
    }
  },

  uploadRemote: async (addr: string, password: string, remoteDir: string, fileName: string, localPath: string) => {
    await shareApi.uploadRemote(addr, password, remoteDir, fileName, localPath);
  },
}));
