/**
 * Redis Storage Implementation for Vercel Deployment
 * 
 * Upstash Redis を使用したストレージ実装
 * ローカルファイルストレージの代替として Vercel にデプロイする際に使用
 */

import { Redis } from '@upstash/redis';

// Job型定義（既存のstorageと互換性を保つ）
export interface Job {
  id: string;
  userId: string;
  type: 'chat' | 'workflow' | 'completion';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  query?: string;
  progress: number;
  result?: any;
  errorMessage?: string;
  streamingLogs?: Array<{
    timestamp: string;
    event: string;
    data: any;
  }>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// Redis クライアントの初期化
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ジョブIDのキーを生成
function getJobKey(id: string): string {
  return `job:${id}`;
}

// ジョブインデックスのキー
const JOBS_INDEX_KEY = 'jobs:index';

/**
 * ジョブを作成
 */
export async function createJob(job: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>): Promise<Job> {
  console.log(`📝 [REDIS STORAGE] Creating new job...`);
  
  const newJob: Job = {
    ...job,
    id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  console.log(`   Job ID: ${newJob.id}`);
  console.log(`   Type: ${newJob.type}`);
  console.log(`   Status: ${newJob.status}`);
  
  // Redisに保存
  await redis.set(getJobKey(newJob.id), JSON.stringify(newJob));
  
  // インデックスに追加（作成日時でソート可能）
  await redis.zadd(JOBS_INDEX_KEY, { 
    score: new Date(newJob.createdAt).getTime(), 
    member: newJob.id 
  });
  
  console.log(`✓ [REDIS STORAGE] Job created and saved to Redis`);
  
  return newJob;
}

/**
 * ジョブを取得
 */
export async function getJob(id: string, retries = 2): Promise<Job | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const data = await redis.get<string>(getJobKey(id));
      
      if (!data) {
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }
        return null;
      }
      
      const job: Job = typeof data === 'string' ? JSON.parse(data) : data;
      return job;
    } catch (error: any) {
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      
      console.error(`❌ [REDIS STORAGE] Failed to get job ${id}:`, error);
      return null;
    }
  }
  
  return null;
}

/**
 * ジョブを更新
 */
export async function updateJob(id: string, updates: Partial<Job>, retries = 2): Promise<Job | null> {
  for (let i = 0; i < retries; i++) {
    try {
      // 既存のジョブを取得
      let job = await getJob(id, 1);
      
      if (!job && i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      
      if (!job) {
        console.warn(`⚠️  [REDIS STORAGE] Job not found: ${id}`);
        return null;
      }
      
      // 重要な更新のみログに記録
      const shouldLog = updates.status || updates.result || updates.errorMessage || 
                        (updates.streamingLogs && updates.streamingLogs.length % 200 === 0);
      
      if (shouldLog) {
        console.log(`📝 [REDIS STORAGE] Updating job ${id}`);
        if (updates.status) console.log(`   Status: ${job.status} → ${updates.status}`);
        if (updates.progress !== undefined) console.log(`   Progress: ${updates.progress}%`);
        if (updates.streamingLogs) console.log(`   Streaming logs: ${updates.streamingLogs.length} events`);
      }
      
      const updatedJob: Job = {
        ...job,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      
      // Redisに保存
      await redis.set(getJobKey(updatedJob.id), JSON.stringify(updatedJob));
      
      // ステータスが変更された場合、インデックスを更新
      if (updates.status) {
        // インデックスのスコアを更新（更新日時で再ソート）
        await redis.zadd(JOBS_INDEX_KEY, { 
          score: new Date(updatedJob.updatedAt).getTime(), 
          member: updatedJob.id 
        });
      }
      
      return updatedJob;
      
    } catch (error: any) {
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      
      console.error(`❌ [REDIS STORAGE] Failed to update job ${id}:`, error);
      return null;
    }
  }
  
  return null;
}

/**
 * すべてのジョブを取得
 */
export async function getAllJobs(): Promise<Job[]> {
  try {
    console.log(`📂 [REDIS STORAGE] Fetching all jobs from Redis...`);
    
    // インデックスから全ジョブIDを取得（新しい順）
    const jobIds = await redis.zrange<string[]>(JOBS_INDEX_KEY, 0, -1, { rev: true });
    
    console.log(`   Found ${jobIds.length} job IDs`);
    
    if (jobIds.length === 0) {
      return [];
    }
    
    // 各ジョブの詳細を取得（並列実行）
    const jobPromises = jobIds.map(id => getJob(id, 1));
    const jobs = await Promise.all(jobPromises);
    
    // null を除外
    const validJobs = jobs.filter((job): job is Job => job !== null);
    
    console.log(`   Successfully loaded ${validJobs.length} jobs`);
    
    // 作成日時でソート（念のため）
    return validJobs.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    console.error(`❌ [REDIS STORAGE] Failed to get all jobs:`, error);
    return [];
  }
}

/**
 * ジョブを削除（オプション）
 */
export async function deleteJob(id: string): Promise<boolean> {
  try {
    console.log(`🗑️  [REDIS STORAGE] Deleting job ${id}...`);
    
    // ジョブデータを削除
    await redis.del(getJobKey(id));
    
    // インデックスから削除
    await redis.zrem(JOBS_INDEX_KEY, id);
    
    console.log(`✓ [REDIS STORAGE] Job ${id} deleted`);
    return true;
  } catch (error) {
    console.error(`❌ [REDIS STORAGE] Failed to delete job ${id}:`, error);
    return false;
  }
}

/**
 * ステータスでジョブをフィルタリング（オプション）
 */
export async function getJobsByStatus(status: Job['status']): Promise<Job[]> {
  const allJobs = await getAllJobs();
  return allJobs.filter(job => job.status === status);
}

/**
 * 古いジョブをクリーンアップ（オプション）
 * @param daysOld 何日以上前のジョブを削除するか
 */
export async function cleanupOldJobs(daysOld: number = 7): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    const cutoffTime = cutoffDate.getTime();
    
    console.log(`🧹 [REDIS STORAGE] Cleaning up jobs older than ${daysOld} days...`);
    
    // 古いジョブIDを取得
    const oldJobIds = await redis.zrange<string[]>(
      JOBS_INDEX_KEY, 
      0,
      cutoffTime,
      { byScore: true }
    );
    
    if (oldJobIds.length === 0) {
      console.log(`   No old jobs to clean up`);
      return 0;
    }
    
    console.log(`   Found ${oldJobIds.length} old jobs`);
    
    // ジョブを削除
    for (const id of oldJobIds) {
      await deleteJob(id);
    }
    
    console.log(`✓ [REDIS STORAGE] Cleaned up ${oldJobIds.length} old jobs`);
    return oldJobIds.length;
  } catch (error) {
    console.error(`❌ [REDIS STORAGE] Failed to cleanup old jobs:`, error);
    return 0;
  }
}

/**
 * Redis接続をテスト
 */
export async function testRedisConnection(): Promise<boolean> {
  try {
    await redis.ping();
    console.log(`✓ [REDIS STORAGE] Redis connection successful`);
    return true;
  } catch (error) {
    console.error(`❌ [REDIS STORAGE] Redis connection failed:`, error);
    return false;
  }
}

