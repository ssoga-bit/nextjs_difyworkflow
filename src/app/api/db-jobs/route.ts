import { NextResponse } from 'next/server';
import { Client } from 'pg';

export async function GET() {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
    query_timeout: 10000,
  });
  
  try {
    await client.connect();
    console.log('📊 [DB JOBS] Fetching all jobs from database...');
    
    // すべてのジョブを取得
    const result = await client.query(`
      SELECT 
        id,
        user_id,
        type,
        status,
        query,
        progress,
        result,
        error_message,
        created_at,
        updated_at,
        completed_at,
        jsonb_array_length(streaming_logs) as log_count
      FROM jobs 
      ORDER BY created_at DESC
    `);
    
    console.log(`✅ [DB JOBS] Found ${result.rows.length} jobs`);
    
    // 各ジョブの詳細情報を整理
    const jobs = result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      status: row.status,
      query: row.query,
      progress: row.progress,
      result: row.result,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      logCount: row.log_count || 0,
      // 結果の要約（長い場合は切り詰め）
      resultSummary: row.result ? 
        (typeof row.result === 'string' ? 
          row.result.substring(0, 100) + (row.result.length > 100 ? '...' : '') :
          JSON.stringify(row.result).substring(0, 100) + '...') : 
        null
    }));
    
    return NextResponse.json({
      status: 'success',
      message: 'Jobs fetched from database',
      totalJobs: jobs.length,
      jobs: jobs,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('❌ [DB JOBS] Failed to fetch jobs:', error);
    
    return NextResponse.json({
      status: 'error',
      message: 'Failed to fetch jobs',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  } finally {
    await client.end();
  }
}
