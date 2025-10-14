import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const JOBS_DIR = path.join(DATA_DIR, 'jobs'); // 個別ジョブファイル用
const JOBS_INDEX_FILE = path.join(DATA_DIR, 'jobs-index.json'); // インデックスのみ

export interface Job {
  id: string;
  userId: string;
  type: 'chat' | 'workflow' | 'completion';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  input: {
    query?: string;
    inputs?: Record<string, any>;
    conversationId?: string;
  };
  result?: any;
  errorMessage?: string;
  streamingLogs?: Array<{
    timestamp: string;
    event: string;
    data?: any;
  }>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// データフォルダが存在しない場合は作成
async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
  
  // ジョブディレクトリも作成
  try {
    await fs.access(JOBS_DIR);
  } catch {
    await fs.mkdir(JOBS_DIR, { recursive: true });
  }
}

// ジョブインデックスを読み込み（軽量）
async function readJobsIndex(): Promise<Record<string, { createdAt: string; status: string; type: string }>> {
  try {
    await ensureDataDir();
    const data = await fs.readFile(JOBS_INDEX_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return {};
    }
    console.warn(`⚠️  [STORAGE] Failed to read jobs index:`, error.message);
    return {};
  }
}

// ジョブインデックスを書き込み
async function writeJobsIndex(index: Record<string, { createdAt: string; status: string; type: string }>): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(JOBS_INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8');
}

// 個別ジョブファイルのパスを取得
function getJobFilePath(jobId: string): string {
  return path.join(JOBS_DIR, `${jobId}.json`);
}

// 書き込みキュー（同時書き込みを防ぐ）
const writeQueue = new Map<string, Promise<void>>();

// 個別ジョブファイルを書き込み（キュー + アトミック操作）
async function writeJobFile(job: Job, retries = 3): Promise<void> {
  await ensureDataDir();
  const jobFile = getJobFilePath(job.id);
  
  // 既に書き込み中の場合は待機
  if (writeQueue.has(job.id)) {
    await writeQueue.get(job.id);
  }
  
  const writePromise = (async () => {
    const jsonData = JSON.stringify(job, null, 2);
    
    for (let i = 0; i < retries; i++) {
      try {
        // 直接上書き（シンプルで安全）
        await fs.writeFile(jobFile, jsonData, 'utf-8');
        return;
      } catch (error: any) {
        if (i < retries - 1) {
          console.warn(`⚠️  [STORAGE] Write job file retry ${i + 1}/${retries} - ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
          continue;
        }
        
        console.error(`❌ [STORAGE] Failed to write job file ${job.id}:`, error);
        throw error;
      }
    }
  })();
  
  writeQueue.set(job.id, writePromise);
  
  try {
    await writePromise;
  } finally {
    writeQueue.delete(job.id);
  }
}

// 個別ジョブファイルを読み込み（リトライ付き）
async function readJobFile(jobId: string, retries = 3): Promise<Job | null> {
  const jobFile = getJobFilePath(jobId);
  
  // 書き込み中の場合は待機
  if (writeQueue.has(jobId)) {
    try {
      await writeQueue.get(jobId);
    } catch {}
  }
  
  for (let i = 0; i < retries; i++) {
    try {
      const data = await fs.readFile(jobFile, 'utf-8');
      
      // 空ファイルチェック
      if (!data || data.trim() === '') {
        if (i < retries - 1) {
          // 警告なし（書き込み中の正常な状態）
          await new Promise(resolve => setTimeout(resolve, 150));
          continue;
        }
        return null;
      }
      
      const job = JSON.parse(data);
      return job;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null;
      }
      
      // JSONパースエラー = ファイル書き込み中または破損
      if (error instanceof SyntaxError && i < retries - 1) {
        // 警告なし（書き込み中の正常な状態）
        await new Promise(resolve => setTimeout(resolve, 200 * (i + 1))); // 200ms, 400ms, 600ms
        continue;
      }
      
      // 最後のリトライでも失敗した場合のみエラー表示
      console.error(`❌ [STORAGE] Error reading job file ${jobId} after ${retries} retries:`, error);
      return null;
    }
  }
  
  return null;
}

// ジョブを作成（個別ファイル方式）
export async function createJob(job: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>): Promise<Job> {
  console.log(`📝 [STORAGE] Creating new job...`);
  
  const newJob: Job = {
    ...job,
    id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  console.log(`   Job ID: ${newJob.id}`);
  console.log(`   Type: ${newJob.type}`);
  console.log(`   Status: ${newJob.status}`);
  
  // 個別ファイルに保存
  await writeJobFile(newJob);
  
  // インデックスを更新
  const index = await readJobsIndex();
  index[newJob.id] = {
    createdAt: newJob.createdAt,
    status: newJob.status,
    type: newJob.type,
  };
  await writeJobsIndex(index);
  
  console.log(`✓ [STORAGE] Job created and saved to: ${getJobFilePath(newJob.id)}`);
  
  return newJob;
}

// ジョブを取得（個別ファイル方式）
export async function getJob(id: string, retries = 2): Promise<Job | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const job = await readJobFile(id);
      
      if (!job && i < retries - 1) {
        // ジョブが見つからない場合、ファイル書き込み中の可能性があるのでリトライ
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      
      return job;
    } catch (error) {
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      
      console.error(`❌ [STORAGE] Failed to get job ${id}:`, error);
      return null;
    }
  }
  
  return null;
}

// ジョブを更新（個別ファイル方式）
export async function updateJob(id: string, updates: Partial<Job>, retries = 2): Promise<Job | null> {
  for (let i = 0; i < retries; i++) {
    try {
      // 個別ファイルから読み込み
      let job = await readJobFile(id);
      
      if (!job && i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      
      if (!job) {
        console.warn(`⚠️  [STORAGE] Job not found: ${id}`);
        return null;
      }
      
      // 重要な更新のみログに記録（進捗更新は除く）
      const shouldLog = updates.status || updates.result || updates.errorMessage || 
                        (updates.streamingLogs && updates.streamingLogs.length % 200 === 0);
      
      if (shouldLog) {
        console.log(`📝 [STORAGE] Updating job ${id}`);
        if (updates.status) console.log(`   Status: ${job.status} → ${updates.status}`);
        if (updates.progress !== undefined) console.log(`   Progress: ${updates.progress}%`);
        if (updates.streamingLogs) console.log(`   Streaming logs: ${updates.streamingLogs.length} events`);
      }
      
      const updatedJob = {
        ...job,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      
      // 個別ファイルに保存
      await writeJobFile(updatedJob);
      
      // インデックスも更新
      if (updates.status) {
        const index = await readJobsIndex();
        if (index[id]) {
          index[id].status = updates.status;
        }
        await writeJobsIndex(index);
      }
      
      return updatedJob;
      
    } catch (error: any) {
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      
      console.error(`❌ [STORAGE] Failed to update job ${id}:`, error);
      return null;
    }
  }
  
  return null;
}

// すべてのジョブを取得（個別ファイル方式）
export async function getAllJobs(): Promise<Job[]> {
  try {
    await ensureDataDir();
    
    // ジョブディレクトリ内の全ファイルを取得
    const files = await fs.readdir(JOBS_DIR);
    const jobFiles = files.filter(f => f.endsWith('.json'));
    
    console.log(`📂 [STORAGE] Found ${jobFiles.length} job files`);
    
    // 各ファイルを読み込み
    const jobs: Job[] = [];
    for (const file of jobFiles) {
      try {
        const jobId = file.replace('.json', '');
        const job = await readJobFile(jobId);
        if (job) {
          jobs.push(job);
        }
      } catch (error) {
        console.warn(`⚠️  [STORAGE] Failed to read job file ${file}`);
      }
    }
    
    // 作成日時でソート
    return jobs.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    console.error(`❌ [STORAGE] Failed to get all jobs:`, error);
    return [];
  }
}

