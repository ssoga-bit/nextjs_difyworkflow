import { createClient } from '@vercel/postgres';

const client = createClient({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL
});

/**
 * データベースのセットアップ
 * テーブルが存在しない場合は作成する
 */
export async function setupDatabase(): Promise<void> {
  try {
    console.log('🔧 [DATABASE SETUP] Checking database tables...');

    // jobsテーブルが存在するかチェック
    const { rows } = await client.sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'jobs'
      );
    `;

    const tableExists = rows[0]?.exists;

    if (!tableExists) {
      console.log('📝 [DATABASE SETUP] Creating jobs table...');
      
      await client.sql`
        CREATE TABLE jobs (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          type VARCHAR(50) NOT NULL,
          status VARCHAR(50) NOT NULL,
          query TEXT,
          progress INTEGER DEFAULT 0,
          result JSONB,
          error_message TEXT,
          streaming_logs JSONB,
          created_at TIMESTAMP NOT NULL,
          updated_at TIMESTAMP NOT NULL,
          completed_at TIMESTAMP
        );
      `;
      
      console.log('✅ [DATABASE SETUP] Jobs table created successfully');
    } else {
      console.log('✅ [DATABASE SETUP] Jobs table already exists');
    }
  } catch (error: any) {
    console.error('❌ [DATABASE SETUP] Failed to setup database:', error);
    throw error;
  }
}

/**
 * データベース接続テスト
 */
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    console.log('🔍 [DATABASE TEST] Testing connection...');
    
    const { rows } = await client.sql`SELECT NOW() as current_time;`;
    const currentTime = rows[0]?.current_time;
    
    console.log('✅ [DATABASE TEST] Connection successful');
    console.log(`   Current time: ${currentTime}`);
    return true;
  } catch (error: any) {
    console.error('❌ [DATABASE TEST] Connection failed:', error);
    return false;
  }
}
