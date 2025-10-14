import { NextResponse } from 'next/server';
import { Client } from 'pg';

export async function GET() {
  let client: Client | null = null;
  
  try {
    console.log('🔌 [DB TEST PG] Starting PostgreSQL connection test with pg client...');
    
    // 接続文字列を解析
    const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    
    if (!connectionString) {
      throw new Error('No connection string found');
    }
    
    console.log('📝 [DB TEST PG] Creating PostgreSQL client...');
    
    // PostgreSQLクライアントの作成
    client = new Client({
      connectionString: connectionString,
      connectionTimeoutMillis: 10000, // 10秒のタイムアウト
      query_timeout: 10000,
    });
    
    console.log('🔗 [DB TEST PG] Connecting to database...');
    const startTime = Date.now();
    
    // 接続
    await client.connect();
    const connectTime = Date.now() - startTime;
    
    console.log(`✅ [DB TEST PG] Connected successfully in ${connectTime}ms`);
    
    // テストクエリの実行
    console.log('🔍 [DB TEST PG] Executing test query...');
    const queryStartTime = Date.now();
    
    const result = await client.query('SELECT NOW() as current_time, version() as version');
    const queryTime = Date.now() - queryStartTime;
    
    console.log(`✅ [DB TEST PG] Query executed successfully in ${queryTime}ms`);
    
    return NextResponse.json({
      status: 'success',
      message: 'PostgreSQL connection test completed',
      result: {
        status: 'connected',
        currentTime: result.rows[0]?.current_time,
        version: result.rows[0]?.version,
        connectionTimeMs: connectTime,
        queryTimeMs: queryTime,
        totalTimeMs: Date.now() - startTime
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('❌ [DB TEST PG] PostgreSQL connection failed:', error);
    
    return NextResponse.json({
      status: 'error',
      message: 'PostgreSQL connection failed',
      error: error.message,
      errorCode: error.code,
      errorType: error.name,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  } finally {
    // 接続を閉じる
    if (client) {
      try {
        await client.end();
        console.log('🔒 [DB TEST PG] Connection closed');
      } catch (closeError) {
        console.error('⚠️ [DB TEST PG] Error closing connection:', closeError);
      }
    }
  }
}
