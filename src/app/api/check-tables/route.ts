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
    console.log('🔍 [CHECK TABLES] Checking database tables...');
    
    // テーブル一覧を取得
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    const tables = tablesResult.rows.map(row => row.table_name);
    
    // jobsテーブルの詳細を取得
    let jobsTableInfo = null;
    if (tables.includes('jobs')) {
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'jobs'
        ORDER BY ordinal_position;
      `);
      
      jobsTableInfo = {
        exists: true,
        columns: columnsResult.rows
      };
    } else {
      jobsTableInfo = {
        exists: false,
        columns: []
      };
    }
    
    console.log('✅ [CHECK TABLES] Table check completed');
    
    return NextResponse.json({
      status: 'success',
      message: 'Table check completed',
      tables: tables,
      jobsTable: jobsTableInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('❌ [CHECK TABLES] Table check failed:', error);
    
    return NextResponse.json({
      status: 'error',
      message: 'Table check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  } finally {
    await client.end();
  }
}
