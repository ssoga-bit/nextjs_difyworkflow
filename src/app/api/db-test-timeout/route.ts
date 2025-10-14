import { NextResponse } from 'next/server';
import { createClient } from '@vercel/postgres';

export async function GET() {
  try {
    console.log('⏱️ [DB TEST TIMEOUT] Starting database connection test with timeout...');
    
    // タイムアウト付きのPromise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database connection timeout after 5 seconds')), 5000);
    });
    
    const connectionPromise = (async () => {
      const client = createClient({
        connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL
      });
      
      console.log('🔌 [DB TEST TIMEOUT] Attempting connection...');
      const result = await client.sql`SELECT NOW() as current_time`;
      console.log('✅ [DB TEST TIMEOUT] Connection successful');
      
      return {
        status: 'connected',
        currentTime: result.rows[0]?.current_time,
        connectionTime: Date.now()
      };
    })();
    
    // タイムアウトまたは接続のどちらかが先に完了
    const result = await Promise.race([connectionPromise, timeoutPromise]);
    
    return NextResponse.json({
      status: 'success',
      message: 'Database connection test completed',
      result: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('❌ [DB TEST TIMEOUT] Database connection failed:', error);
    
    return NextResponse.json({
      status: 'error',
      message: 'Database connection failed',
      error: error.message,
      errorType: error.name,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
