import { NextRequest, NextResponse } from 'next/server';
import { createJob } from '@/lib/storage-postgres-std';
import { processJob } from '@/lib/job-processor';

export async function POST(request: NextRequest) {
  const requestId = `req-${Date.now()}`;
  
  try {
    console.log('='.repeat(60));
    console.log(`📥 [API /jobs/start] Request ID: ${requestId}`);
    
    const body = await request.json();
    const { type, userId, input } = body;

    console.log(`   Type: ${type}`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Input:`, JSON.stringify(input, null, 2));

    // バリデーション
    if (!type || !userId || !input) {
      console.error(`❌ [API /jobs/start] Validation failed - missing required fields`);
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log(`📝 [API /jobs/start] Creating job...`);
    
    // ジョブをJSONファイルに作成
    const job = await createJob({
      type,
      userId,
      status: 'pending',
      progress: 0,
      input,
    });

    console.log(`✓ [API /jobs/start] Job created: ${job.id}`);
    console.log(`🚀 [API /jobs/start] Starting background processing...`);

    // バックグラウンドで処理開始（非同期・非ブロッキング）
    processJob(job.id, type, userId, input);

    console.log(`✓ [API /jobs/start] Response sent to client`);
    console.log('='.repeat(60));

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: 'Job started successfully',
    });

  } catch (error: any) {
    console.log('='.repeat(60));
    console.error(`❌ [API /jobs/start] Error - Request ID: ${requestId}`);
    console.error(`   Error: ${error.message}`);
    console.error(`   Stack:`, error.stack);
    console.log('='.repeat(60));
    
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

