import { Client } from 'pg';

// PostgreSQLクライアントの作成
function createPgClient(): Client {
  return new Client({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
    query_timeout: 10000,
  });
}

/**
 * データベースのセットアップ
 * テーブルが存在しない場合は作成する
 */
export async function setupDatabase(): Promise<void> {
  const client = createPgClient();
  
  try {
    await client.connect();
    console.log('🔧 [DATABASE SETUP STD] Checking database tables...');

    // jobsテーブルが存在するかチェック
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'jobs'
      );
    `);

    const tableExists = result.rows[0]?.exists;

    if (!tableExists) {
      console.log('📝 [DATABASE SETUP STD] Creating jobs table...');
      
      await client.query(`
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
      `);
      
      console.log('✅ [DATABASE SETUP STD] Jobs table created successfully');
    } else {
      console.log('✅ [DATABASE SETUP STD] Jobs table already exists');
    }
  } catch (error: any) {
    console.error('❌ [DATABASE SETUP STD] Failed to setup database:', error);
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * データベース接続テスト
 */
export async function testDatabaseConnection(): Promise<boolean> {
  const client = createPgClient();
  
  try {
    await client.connect();
    console.log('🔍 [DATABASE TEST STD] Testing connection...');
    
    const result = await client.query('SELECT NOW() as current_time');
    const currentTime = result.rows[0]?.current_time;
    
    console.log('✅ [DATABASE TEST STD] Connection successful');
    console.log(`   Current time: ${currentTime}`);
    return true;
  } catch (error: any) {
    console.error('❌ [DATABASE TEST STD] Connection failed:', error);
    return false;
  } finally {
    await client.end();
  }
}
