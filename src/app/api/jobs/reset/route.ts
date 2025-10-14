import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const JOBS_FILE = path.join(DATA_DIR, 'jobs.json');

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [API /jobs/reset] Resetting jobs.json...');
    
    // バックアップを作成
    const backupFile = path.join(DATA_DIR, `jobs.json.backup.${Date.now()}`);
    
    try {
      await fs.copyFile(JOBS_FILE, backupFile);
      console.log(`✓ [API /jobs/reset] Backup created: ${backupFile}`);
    } catch (error) {
      console.log(`⚠️  [API /jobs/reset] No existing file to backup`);
    }
    
    // 新しい空のファイルを作成
    await fs.writeFile(JOBS_FILE, JSON.stringify({}, null, 2), 'utf-8');
    console.log(`✓ [API /jobs/reset] New jobs.json created`);

    return NextResponse.json({
      success: true,
      message: 'Jobs storage reset successfully',
      backup: backupFile,
    });

  } catch (error: any) {
    console.error('❌ [API /jobs/reset] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

