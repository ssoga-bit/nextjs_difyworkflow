import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('🔍 [DEBUG] Checking connection strings...');
    
    const postgresUrl = process.env.POSTGRES_URL;
    const databaseUrl = process.env.DATABASE_URL;
    
    // 接続文字列の基本情報を表示（セキュリティのため一部マスク）
    const maskedPostgresUrl = postgresUrl ? 
      postgresUrl.replace(/:[^:]*@/, ':***@') : 'Not set';
    
    const maskedDatabaseUrl = databaseUrl ? 
      databaseUrl.replace(/:[^:]*@/, ':***@') : 'Not set';
    
    // 接続文字列の解析
    const postgresInfo = postgresUrl ? {
      hasUrl: true,
      startsWith: postgresUrl.substring(0, 20) + '...',
      length: postgresUrl.length,
      hasSsl: postgresUrl.includes('sslmode'),
      host: postgresUrl.includes('@') ? postgresUrl.split('@')[1].split(':')[0] : 'unknown'
    } : { hasUrl: false };
    
    const databaseInfo = databaseUrl ? {
      hasUrl: true,
      startsWith: databaseUrl.substring(0, 20) + '...',
      length: databaseUrl.length,
      hasSsl: databaseUrl.includes('sslmode'),
      host: databaseUrl.includes('@') ? databaseUrl.split('@')[1].split(':')[0] : 'unknown'
    } : { hasUrl: false };
    
    console.log('✅ [DEBUG] Connection string analysis completed');
    
    return NextResponse.json({
      status: 'ok',
      message: 'Connection string analysis',
      postgresUrl: {
        masked: maskedPostgresUrl,
        info: postgresInfo
      },
      databaseUrl: {
        masked: maskedDatabaseUrl,
        info: databaseInfo
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('❌ [DEBUG] Connection analysis failed:', error);
    return NextResponse.json({
      status: 'error',
      error: error.message
    }, { status: 500 });
  }
}
