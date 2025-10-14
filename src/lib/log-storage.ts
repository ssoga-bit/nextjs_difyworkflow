import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');

export interface DifyLog {
  id: string;
  difyLogId: string;
  logType: string;
  content: any;
  userId: string;
  status: string;
  fetchedAt: string;
  createdAt: string;
}

interface LogsData {
  logs: DifyLog[];
}

// データフォルダが存在しない場合は作成
async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

// ログデータを読み込み
async function readLogs(): Promise<LogsData> {
  try {
    await ensureDataDir();
    const data = await fs.readFile(LOGS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return { logs: [] };
  }
}

// ログデータを書き込み
async function writeLogs(data: LogsData): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(LOGS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// ログを追加または更新
export async function upsertLog(log: Omit<DifyLog, 'id'>): Promise<DifyLog> {
  const data = await readLogs();
  
  // 既存のログを検索
  const existingIndex = data.logs.findIndex(l => l.difyLogId === log.difyLogId);
  
  if (existingIndex >= 0) {
    // 更新
    data.logs[existingIndex] = {
      ...data.logs[existingIndex],
      ...log,
      id: data.logs[existingIndex].id,
    };
    await writeLogs(data);
    return data.logs[existingIndex];
  } else {
    // 新規作成
    const newLog: DifyLog = {
      ...log,
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    data.logs.unshift(newLog); // 先頭に追加
    await writeLogs(data);
    return newLog;
  }
}

// すべてのログを取得（ページネーション）
export async function getAllLogs(page: number = 1, limit: number = 20): Promise<{
  logs: DifyLog[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const data = await readLogs();
  const total = data.logs.length;
  const start = (page - 1) * limit;
  const end = start + limit;
  const logs = data.logs.slice(start, end);
  
  return {
    logs,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

