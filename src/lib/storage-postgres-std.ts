/**
 * PostgreSQL Storage Implementation - Standard Client
 * 
 * 標準のPostgreSQLクライアントを使用したストレージ実装
 * Vercel Postgresに問題がある場合の代替案
 */

import { Client } from 'pg';

// PostgreSQLクライアントの作成
function createPgClient(): Client {
  return new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
    query_timeout: 10000,
  });
}

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
  console.log(`📝 [POSTGRES STD] Creating new job...`);
  
  const newJob: Job = {
    ...job,
    id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  console.log(`   Job ID: ${newJob.id}`);
  console.log(`   Type: ${newJob.type}`);
  console.log(`   Status: ${newJob.status}`);
  
  const client = createPgClient();
  
  try {
    await client.connect();
    
    await client.query(`
      INSERT INTO jobs (
        id, user_id, type, status, query, progress, 
        result, error_message, streaming_logs, 
        created_at, updated_at, completed_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      newJob.id,
      newJob.userId,
      newJob.type,
      newJob.status,
      newJob.query || null,
      newJob.progress,
      JSON.stringify(newJob.result || {}),
      newJob.errorMessage || null,
      JSON.stringify(newJob.streamingLogs || []),
      newJob.createdAt,
      newJob.updatedAt,
      newJob.completedAt || null
    ]);
    
    console.log(`✓ [POSTGRES STD] Job created and saved to PostgreSQL`);
    return newJob;
  } catch (error: any) {
    console.error(`❌ [POSTGRES STD] Failed to create job:`, error);
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * ジョブを取得
 */
export async function getJob(id: string, retries = 2): Promise<Job | null> {
  for (let i = 0; i < retries; i++) {
    const client = createPgClient();
    
    try {
      await client.connect();
      
      const result = await client.query(`
        SELECT * FROM jobs WHERE id = $1
      `, [id]);
      
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
      
      console.error(`❌ [POSTGRES STD] Failed to get job ${id}:`, error);
      return null;
    } finally {
      await client.end();
    }
  }
  
  return null;
}

/**
 * ジョブを更新
 */
export async function updateJob(id: string, updates: Partial<Job>, retries = 2): Promise<Job | null> {
  for (let i = 0; i < retries; i++) {
    const client = createPgClient();
    
    try {
      await client.connect();
      
      // 既存のジョブを取得
      const currentJob = await getJob(id, 1);
      
      if (!currentJob && i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      
      if (!currentJob) {
        console.warn(`⚠️  [POSTGRES STD] Job not found: ${id}`);
        return null;
      }
      
      // 重要な更新のみログに記録
      const shouldLog = updates.status || updates.result || updates.errorMessage || 
                        (updates.streamingLogs && updates.streamingLogs.length % 200 === 0);
      
      if (shouldLog) {
        console.log(`📝 [POSTGRES STD] Updating job ${id}`);
        if (updates.status) console.log(`   Status: ${currentJob.status} → ${updates.status}`);
        if (updates.progress !== undefined) console.log(`   Progress: ${updates.progress}%`);
        if (updates.streamingLogs) console.log(`   Streaming logs: ${updates.streamingLogs.length} events`);
      }
      
      const updatedJob = {
        ...currentJob,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      
      await client.query(`
        UPDATE jobs
        SET 
          status = $1,
          progress = $2,
          result = $3,
          error_message = $4,
          streaming_logs = $5,
          updated_at = $6,
          completed_at = $7
        WHERE id = $8
      `, [
        updatedJob.status,
        updatedJob.progress,
        JSON.stringify(updatedJob.result || {}),
        updatedJob.errorMessage || null,
        JSON.stringify(updatedJob.streamingLogs || []),
        updatedJob.updatedAt,
        updatedJob.completedAt || null,
        id
      ]);
      
      return updatedJob;
      
    } catch (error: any) {
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      
      console.error(`❌ [POSTGRES STD] Failed to update job ${id}:`, error);
      return null;
    } finally {
      await client.end();
    }
  }
  
  return null;
}

/**
 * すべてのジョブを取得
 */
export async function getAllJobs(): Promise<Job[]> {
  const client = createPgClient();
  
  try {
    await client.connect();
    
    console.log(`📂 [POSTGRES STD] Fetching all jobs from PostgreSQL...`);
    
    const result = await client.query(`
      SELECT * FROM jobs 
      ORDER BY created_at DESC
    `);
    
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
    console.error(`❌ [POSTGRES STD] Failed to get all jobs:`, error);
    return [];
  } finally {
    await client.end();
  }
}

/**
 * データベース接続をテスト
 */
export async function testDatabaseConnection(): Promise<boolean> {
  const client = createPgClient();
  
  try {
    await client.connect();
    await client.query('SELECT 1');
    console.log(`✓ [POSTGRES STD] PostgreSQL connection successful`);
    return true;
  } catch (error) {
    console.error(`❌ [POSTGRES STD] PostgreSQL connection failed:`, error);
    return false;
  } finally {
    await client.end();
  }
}
