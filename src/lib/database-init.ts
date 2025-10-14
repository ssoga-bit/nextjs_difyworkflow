import { setupDatabase, testDatabaseConnection } from './database-setup';

/**
 * データベースの初期化
 * アプリケーション起動時に実行
 */
export async function initializeDatabase(): Promise<void> {
  try {
    console.log('🚀 [DATABASE INIT] Starting database initialization...');
    
    // 接続テスト
    const connectionOk = await testDatabaseConnection();
    if (!connectionOk) {
      throw new Error('Database connection failed');
    }
    
    // テーブルセットアップ
    await setupDatabase();
    
    console.log('✅ [DATABASE INIT] Database initialization completed successfully');
  } catch (error: any) {
    console.error('❌ [DATABASE INIT] Database initialization failed:', error);
    throw error;
  }
}

// 開発環境での自動実行
if (process.env.NODE_ENV === 'development') {
  initializeDatabase().catch(console.error);
}
