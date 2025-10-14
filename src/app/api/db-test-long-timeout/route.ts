import { NextResponse } from 'next/server';
import { createClient } from '@vercel/postgres';

export async function GET() {
  try {
    console.log('⏱️ [DB TEST LONG] Starting database connection test with 30 second timeout...');
    
    // 30秒のタイムアウト
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database connection timeout after 30 seconds')), 30000);
    });
    
    const connectionPromise = (async () => {
      const client = createClient({
        connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL
      });
      
      console.log('🔌 [DB TEST LONG] Attempting connection...');
      const startTime = Date.now();
      
      const result = await client.sql`SELECT NOW() as current_time`;
      
      const endTime = Date.now();
      const connectionTime = endTime - startTime;
      
      console.log(`✅ [DB TEST LONG] Connection successful in ${connectionTime}ms`);
      
      return {
        status: 'connected',
        currentTime: result.rows[0]?.current_time,
        connectionTimeMs: connectionTime,
        startTime: startTime,
        endTime: endTime
      };
    })();
    
    const result = await Promise.race([connectionPromise, timeoutPromise]);
    
    return NextResponse.json({
      status: 'success',
      message: 'Database connection test completed',
      result: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('❌ [DB TEST LONG] Database connection failed:', error);
    
    return NextResponse.json({
      status: 'error',
      message: 'Database connection failed',
      error: error.message,
      errorType: error.name,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
