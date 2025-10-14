import { NextRequest, NextResponse } from 'next/server';
import { fetchAndStoreDifyLogs } from '@/lib/cron';

export async function GET(request: NextRequest) {
  try {
    // ログ取得実行
    await fetchAndStoreDifyLogs();

    return NextResponse.json({
      success: true,
      message: 'Logs fetched successfully',
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Error in fetch-logs API:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

