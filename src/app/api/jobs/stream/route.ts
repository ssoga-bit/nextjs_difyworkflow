/**
 * SSE (Server-Sent Events) API - 現在未使用
 * 
 * ポーリング方式に変更されたため、このエンドポイントは現在使用されていません。
 * 将来的にリアルタイム性を向上させる場合の参考として残しています。
 * 
 * Vercelデプロイ時の制限:
 * - Hobby: 最大10秒
 * - Pro: 最大300秒（5分）
 * 長時間ワークフローにはポーリングまたはWebhookを推奨
 */

import { NextRequest } from 'next/server';
import { getJob } from '@/lib/storage-postgres-std';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    console.error('❌ [API /jobs/stream] Job ID not provided');
    return new Response('Job ID required', { status: 400 });
  }

  console.log(`🔌 [API /jobs/stream] SSE connection opened for job: ${jobId}`);

  // Server-Sent Eventsの設定
  const encoder = new TextEncoder();
  let messageCount = 0;
  
  const stream = new ReadableStream({
    async start(controller) {
      let jobNotFoundCount = 0;
      const MAX_JOB_NOT_FOUND_RETRIES = 10; // 最大10秒待つ（1秒×10回）
      
      const sendEvent = (data: any) => {
        try {
          messageCount++;
          const message = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
          
          // 10メッセージごとにログ
          if (messageCount % 10 === 0) {
            console.log(`📤 [SSE ${jobId}] Sent message ${messageCount} - Status: ${data.status}, Logs: ${data.streamingLogs?.length || 0}`);
          }
        } catch (error) {
          console.error(`❌ [SSE ${jobId}] Error sending event:`, error);
        }
      };

      // 定期的にジョブの状態をチェック
      const intervalId = setInterval(async () => {
        try {
          const job = await getJob(jobId);

          if (!job) {
            jobNotFoundCount++;
            
            // 最初の数回は待機（ジョブ作成中の可能性）
            if (jobNotFoundCount <= MAX_JOB_NOT_FOUND_RETRIES) {
              console.log(`⏳ [SSE ${jobId}] Job not found, waiting... (${jobNotFoundCount}/${MAX_JOB_NOT_FOUND_RETRIES})`);
              sendEvent({ error: 'Job not found' }); // クライアントに通知（エラー扱いしない）
              return; // 接続は継続
            }
            
            // 最大リトライ回数を超えた場合は終了
            console.warn(`❌ [SSE ${jobId}] Job not found after ${MAX_JOB_NOT_FOUND_RETRIES} retries. Closing connection.`);
            sendEvent({ error: 'Job not found', permanent: true });
            clearInterval(intervalId);
            controller.close();
            return;
          }
          
          // ジョブが見つかったらカウンターをリセット
          if (jobNotFoundCount > 0) {
            console.log(`✓ [SSE ${jobId}] Job found after ${jobNotFoundCount} retries`);
            jobNotFoundCount = 0;
          }

          sendEvent({
            status: job.status,
            progress: job.progress,
            result: job.result,
            errorMessage: job.errorMessage,
            streamingLogs: job.streamingLogs || [],
            updatedAt: job.updatedAt,
            type: job.type,
            createdAt: job.createdAt,
          });

          // ジョブが完了または失敗したら接続を閉じる
          if (job.status === 'completed' || job.status === 'failed') {
            console.log(`✓ [SSE ${jobId}] Job ${job.status}. Closing connection. Messages sent: ${messageCount}`);
            clearInterval(intervalId);
            controller.close();
          }

        } catch (error: any) {
          console.error('='.repeat(60));
          console.error(`❌ [SSE ${jobId}] Error in stream:`, error);
          console.error(`   Error message: ${error.message}`);
          console.error(`   Messages sent: ${messageCount}`);
          console.error('='.repeat(60));
          
          sendEvent({ error: 'Internal server error', details: error.message });
          clearInterval(intervalId);
          controller.close();
        }
      }, 2000); // 2秒ごとに更新（ファイル競合を減らすため）

      // クライアントが接続を切断した時
      request.signal.addEventListener('abort', () => {
        console.log(`🔌 [SSE ${jobId}] Client disconnected. Messages sent: ${messageCount}`);
        clearInterval(intervalId);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

