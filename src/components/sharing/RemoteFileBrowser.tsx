import { useCallback, useState, useEffect } from "react";
import Modal from "@/components/common/Modal";
import { useShareStore } from "@/stores/useShareStore";
import RemoteFileBrowserPanel from "./RemoteFileBrowserPanel";
import { shareApi } from "@/lib/tauri-api";
import type { SharedConnection } from "@/types";

interface RemoteFileBrowserProps {
  conn: SharedConnection;
  onClose: () => void;
}

export default function RemoteFileBrowser({ conn, onClose }: RemoteFileBrowserProps) {
  const { updateLastPath } = useShareStore();
  const [password, setPassword] = useState<string>(conn.password ?? "");
  const [loading, setLoading] = useState(!conn.password);

  useEffect(() => {
    if (!conn.password) {
      shareApi.getConnectionPassword(conn.addr).then((pwd) => {
        setPassword(pwd);
        setLoading(false);
      }).catch(() => {
        setLoading(false);
      });
    }
  }, [conn.addr, conn.password]);

  const handlePathChange = useCallback((path: string) => {
    updateLastPath(conn.addr, path);
  }, [conn.addr, updateLastPath]);

  if (loading) {
    return (
      <Modal open={true} onClose={onClose} title={`远程文件 — ${conn.label}`} width="max-w-md">
        <div className="flex items-center justify-center py-8 text-[var(--text-muted)]">加载中...</div>
      </Modal>
    );
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={`远程文件 — ${conn.label}`}
      width="max-w-md"
      footer={
        <button className="btn btn-ghost btn-sm" onClick={onClose}>
          关闭
        </button>
      }
    >
      <RemoteFileBrowserPanel
        addr={conn.addr}
        password={password}
        initialPath={conn.last_path || ""}
        showUpload={true}
        useStoreUpload={true}
        onPathChange={handlePathChange}
      />
    </Modal>
  );
}
