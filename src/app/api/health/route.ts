import { NextResponse } from 'next/server';
import { testDatabaseConnection } from '@/lib/storage-postgres-std';
import { setupDatabase } from '@/lib/database-setup-std';

export async function GET() {
  try {
    console.log('🏥 [HEALTH CHECK] Starting health check...');
    
    // データベース接続テスト
    const dbConnected = await testDatabaseConnection();
    
    if (!dbConnected) {
      console.log('🔧 [HEALTH CHECK] Database not connected, setting up...');
      await setupDatabase();
    }
    
    // 最終的な接続確認
    const finalCheck = await testDatabaseConnection();
    
    if (finalCheck) {
      console.log('✅ [HEALTH CHECK] All systems healthy');
      return NextResponse.json({
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('❌ [HEALTH CHECK] Database connection failed');
      return NextResponse.json({
        status: 'unhealthy',
        database: 'disconnected',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('❌ [HEALTH CHECK] Health check failed:', error);
    return NextResponse.json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}