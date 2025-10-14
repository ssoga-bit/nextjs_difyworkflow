/**
 * PostgreSQL Storage Implementation - Direct Connection
 * 
 * 直接接続文字列を使用したPostgreSQLストレージ実装
 * Vercel環境変数に問題がある場合の代替案
 */

import { createClient } from '@vercel/postgres';

// 直接接続文字列を指定
const client = createClient({
  connectionString: process.env.POSTGRES_URL || 
    'postgres://01bab3d374f15b721f23b4521386a6c8b187097887243d2dff9d3dbba50af40e:sk_jFhaeKfXoEovMcvhi4BDj@db.prisma.io:5432/postgres?sslmode=require'
});

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

/**
 * ジョブを作成
 */
export async function createJob(job: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>): Promise<Job> {
  console.log(`📝 [POSTGRES DIRECT] Creating new job...`);
  
  const newJob: Job = {
    ...job,
    id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  console.log(`   Job ID: ${newJob.id}`);
  console.log(`   Type: ${newJob.type}`);
  console.log(`   Status: ${newJob.status}`);
  
  try {
    await client.sql`
      INSERT INTO jobs (
        id, user_id, type, status, query, progress, 
        result, error_message, streaming_logs, 
        created_at, updated_at, completed_at
      )
      VALUES (
        ${newJob.id},
        ${newJob.userId},
        ${newJob.type},
        ${newJob.status},
        ${newJob.query || null},
        ${newJob.progress},
        ${JSON.stringify(newJob.result || {})},
        ${newJob.errorMessage || null},
        ${JSON.stringify(newJob.streamingLogs || [])},
        ${newJob.createdAt},
        ${newJob.updatedAt},
        ${newJob.completedAt || null}
      )
    `;
    
    console.log(`✓ [POSTGRES DIRECT] Job created and saved to PostgreSQL`);
    return newJob;
  } catch (error: any) {
    console.error(`❌ [POSTGRES DIRECT] Failed to create job:`, error);
    throw error;
  }
}

/**
 * ジョブを取得
 */
export async function getJob(id: string, retries = 2): Promise<Job | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await client.sql`
        SELECT * FROM jobs WHERE id = ${id}
      `;
      
      if (result.rows.length === 0) {
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }
        return null;
      }
      
      const row = result.rows[0];
      return {
        id: row.id,
        userId: row.user_id,
        type: row.type,
        status: row.status,
        query: row.query,
        progress: row.progress,
        result: row.result,
        errorMessage: row.error_message,
        streamingLogs: row.streaming_logs || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        completedAt: row.completed_at,
      };
    } catch (error: any) {
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      
      console.error(`❌ [POSTGRES DIRECT] Failed to get job ${id}:`, error);
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
      const currentJob = await getJob(id, 1);
      
      if (!currentJob && i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      
      if (!currentJob) {
        console.warn(`⚠️  [POSTGRES DIRECT] Job not found: ${id}`);
        return null;
      }
      
      // 重要な更新のみログに記録
      const shouldLog = updates.status || updates.result || updates.errorMessage || 
                        (updates.streamingLogs && updates.streamingLogs.length % 200 === 0);
      
      if (shouldLog) {
        console.log(`📝 [POSTGRES DIRECT] Updating job ${id}`);
        if (updates.status) console.log(`   Status: ${currentJob.status} → ${updates.status}`);
        if (updates.progress !== undefined) console.log(`   Progress: ${updates.progress}%`);
        if (updates.streamingLogs) console.log(`   Streaming logs: ${updates.streamingLogs.length} events`);
      }
      
      const updatedJob = {
        ...currentJob,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      
      await client.sql`
        UPDATE jobs
        SET 
          status = ${updatedJob.status},
          progress = ${updatedJob.progress},
          result = ${JSON.stringify(updatedJob.result || {})},
          error_message = ${updatedJob.errorMessage || null},
          streaming_logs = ${JSON.stringify(updatedJob.streamingLogs || [])},
          updated_at = ${updatedJob.updatedAt},
          completed_at = ${updatedJob.completedAt || null}
        WHERE id = ${id}
      `;
      
      return updatedJob;
      
    } catch (error: any) {
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      
      console.error(`❌ [POSTGRES DIRECT] Failed to update job ${id}:`, error);
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
    console.log(`📂 [POSTGRES DIRECT] Fetching all jobs from PostgreSQL...`);
    
    const result = await client.sql`
      SELECT * FROM jobs 
      ORDER BY created_at DESC
    `;
    
    console.log(`   Found ${result.rows.length} jobs`);
    
    return result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      status: row.status,
      query: row.query,
      progress: row.progress,
      result: row.result,
      errorMessage: row.error_message,
      streamingLogs: row.streaming_logs || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
    }));
  } catch (error) {
    console.error(`❌ [POSTGRES DIRECT] Failed to get all jobs:`, error);
    return [];
  }
}

/**
 * データベース接続をテスト
 */
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await client.sql`SELECT 1`;
    console.log(`✓ [POSTGRES DIRECT] PostgreSQL connection successful`);
    return true;
  } catch (error) {
    console.error(`❌ [POSTGRES DIRECT] PostgreSQL connection failed:`, error);
    return false;
  }
}
