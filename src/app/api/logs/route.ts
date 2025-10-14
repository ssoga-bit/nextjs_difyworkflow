import { NextRequest, NextResponse } from 'next/server';
import { getAllLogs } from '@/lib/log-storage';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const result = await getAllLogs(page, limit);

    return NextResponse.json({
      logs: result.logs,
      pagination: {
        page: result.page,
        limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });

  } catch (error: any) {
    console.error('Error fetching logs:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

