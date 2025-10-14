import { NextRequest, NextResponse } from 'next/server';
import { getJob, updateJob } from '@/lib/storage-postgres-std';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const job = await getJob(id);

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // ログの件数を確認
    console.log(`📋 Fetching job ${id}: ${job.streamingLogs?.length || 0} streaming logs`);

    return NextResponse.json(job);

  } catch (error: any) {
    console.error('Error fetching job:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// ジョブキャンセル（オプション）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const job = await updateJob(id, {
      status: 'failed',
      errorMessage: 'Cancelled by user',
    });

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Job cancelled',
    });

  } catch (error: any) {
    console.error('Error cancelling job:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

