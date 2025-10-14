import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('🏥 [HEALTH SIMPLE] Starting simple health check...');
    
    // 環境変数の確認
    const envVars = {
      NODE_ENV: process.env.NODE_ENV,
      POSTGRES_URL: process.env.POSTGRES_URL ? 'Set' : 'Not set',
      DATABASE_URL: process.env.DATABASE_URL ? 'Set' : 'Not set',
    };
    
    console.log('✅ [HEALTH SIMPLE] Basic health check passed');
    
    return NextResponse.json({
      status: 'healthy',
      message: 'Basic health check passed',
      environment: envVars,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('❌ [HEALTH SIMPLE] Health check failed:', error);
    return NextResponse.json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
