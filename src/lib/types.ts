// Shared domain types for guymadown download manager.
// These contracts are used by the API routes, the socket.io engine
// mini-service and the React frontend.

export type DownloadStatus =
  | "pending"
  | "analyzing"
  | "queued"
  | "downloading"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled"
  | "retrying";

export interface SegmentDTO {
  id: string;
  index: number;
  startByte: string; // BigInt serialized as string
  endByte: string;
  downloadedBytes: string;
  status: "pending" | "downloading" | "completed" | "failed" | "idle";
  workerId: number;
}

export interface DownloadDTO {
  id: string;
  url: string;
  finalUrl: string | null;
  filename: string;
  category: string;
  mimeType: string | null;
  size: string; // BigInt as string
  downloaded: string;
  status: DownloadStatus;
  speed: number;
  avgSpeed: number;
  eta: number;
  connections: number;
  supportsRange: boolean;
  etag: string | null;
  lastModified: string | null;
  server: string | null;
  outputPath: string | null;
  queueId: string | null;
  error: string | null;
  description: string | null;
  segmentsTotal: number;
  addedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  lastTryAt: string | null;
  retries: number;
  progress: number; // 0..1
  segments?: SegmentDTO[];
}

export interface CategoryDTO {
  id: string;
  name: string;
  color: string;
  extensions: string[];
  destination: string | null;
  namingRule: string | null;
  position: number;
}

export interface QueueDTO {
  id: string;
  name: string;
  maxConcurrent: number;
  connectionsPerDl: number;
  speedLimit: number;
  priority: number;
  active: boolean;
  startAt: string | null;
  stopAt: string | null;
  retryMax: number;
  endAction: "none" | "notify" | "shutdown";
  createdAt: string;
  itemCount: number;
}

export interface SettingDTO {
  key: string;
  value: string;
}

export interface ErrorLogDTO {
  id: string;
  downloadId: string | null;
  code: string;
  message: string;
  timestamp: string;
}

export interface GrabberProjectDTO {
  id: string;
  url: string;
  depth: number;
  maxPages: number;
  status: string;
  config: string;
  createdAt: string;
}

export interface GrabberResource {
  url: string;
  type: "page" | "image" | "video" | "audio" | "document" | "archive" | "script" | "style" | "other";
  filename: string;
  extension: string;
  size: number | null;
}

// Socket.io events (engine -> client)
export interface EngineEvents {
  "download.created": (d: DownloadDTO) => void;
  "download.started": (d: { id: string }) => void;
  "download.progress": (d: {
    id: string;
    downloaded: string;
    size: string;
    speed: number;
    avgSpeed: number;
    eta: number;
    progress: number;
    segments: SegmentDTO[];
  }) => void;
  "download.paused": (d: { id: string }) => void;
  "download.resumed": (d: { id: string }) => void;
  "download.completed": (d: { id: string; outputPath: string }) => void;
  "download.failed": (d: { id: string; error: string }) => void;
  "download.retrying": (d: { id: string; retry: number }) => void;
  "download.cancelled": (d: { id: string }) => void;
  "queue.started": (d: { id: string }) => void;
  "queue.completed": (d: { id: string }) => void;
  "engine.error": (d: { message: string }) => void;
  "engine.state": (d: { activeCount: number; queuedCount: number }) => void;
}

// Socket.io events (client -> engine)
export interface ClientCommands {
  add_download: (payload: {
    url: string;
    filename?: string;
    category?: string;
    connections?: number;
    queueId?: string;
  }) => void;
  start_download: (payload: { id: string }) => void;
  pause_download: (payload: { id: string }) => void;
  resume_download: (payload: { id: string }) => void;
  cancel_download: (payload: { id: string }) => void;
  set_speed_limit: (payload: { id: string; limit: number }) => void;
  start_queue: (payload: { id: string }) => void;
  stop_queue: (payload: { id: string }) => void;
}

export const DEFAULT_CATEGORIES: Array<{
  name: string;
  color: string;
  extensions: string;
}> = [
  { name: "Compressés", color: "#f59e0b", extensions: "zip,rar,7z,tar,gz,iso" },
  { name: "Documents", color: "#10b981", extensions: "pdf,doc,docx,xls,xlsx,ppt,txt" },
  { name: "Musique", color: "#ec4899", extensions: "mp3,flac,wav,aac,ogg" },
  { name: "Programmes", color: "#ef4444", extensions: "exe,msi,deb,apk" },
  { name: "Vidéos", color: "#8b5cf6", extensions: "mp4,mkv,avi,mov,webm" },
  { name: "Images", color: "#06b6d4", extensions: "jpg,jpeg,png,gif,webp,svg" },
  { name: "Autres", color: "#64748b", extensions: "" },
];

export function classifyByExtension(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  for (const cat of DEFAULT_CATEGORIES) {
    if (cat.extensions.split(",").includes(ext)) return cat.name;
  }
  return "Autres";
}

export function formatBytes(bytes: number | string | null | undefined): string {
  const n =
    typeof bytes === "string"
      ? Number(bytes)
      : bytes == null
        ? 0
        : bytes;
  if (!n || n <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return "—";
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatEta(seconds: number): string {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}
