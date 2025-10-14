import { difyClient } from './dify-client';
import { updateJob } from './storage-postgres-std';

// アクティブなジョブを管理するMap
const activeJobs = new Map<string, Promise<void>>();

export async function processJob(jobId: string, type: 'chat' | 'workflow' | 'completion', userId: string, input: any) {
  console.log('='.repeat(80));
  console.log(`🚀 [JOB START] Job ID: ${jobId}`);
  console.log(`   Type: ${type}`);
  console.log(`   User: ${userId}`);
  console.log(`   Input:`, JSON.stringify(input, null, 2));
  console.log(`   Timestamp: ${new Date().toISOString()}`);
  console.log('='.repeat(80));

  // すでに処理中の場合はスキップ
  if (activeJobs.has(jobId)) {
    console.log(`⚠️  [JOB ${jobId}] Already processing, skipping duplicate request`);
    return;
  }

  const jobPromise = (async () => {
    const startTime = Date.now();
    
    try {
      console.log(`📝 [JOB ${jobId}] Updating status to 'processing'...`);
      
      // ステータスを PROCESSING に更新
      await updateJob(jobId, {
        status: 'processing',
        progress: 0,
      });

      console.log(`✓ [JOB ${jobId}] Status updated to 'processing'`);

      let result;

      // ジョブタイプに応じた処理
      if (type === 'chat') {
        // チャットメッセージ送信
        console.log(`💬 [JOB ${jobId}] Processing CHAT job`);
        console.log(`   Query: "${input.query}"`);
        console.log(`   Conversation ID: ${input.conversationId || 'new'}`);
        
        await updateJob(jobId, { progress: 25 });
        console.log(`📊 [JOB ${jobId}] Progress: 25%`);
        
        result = await difyClient.sendMessage({
          query: input.query,
          user: userId,
          conversationId: input.conversationId,
          responseMode: 'blocking',
        });

        console.log(`✓ [JOB ${jobId}] Chat response received`);
        await updateJob(jobId, { progress: 75 });
        console.log(`📊 [JOB ${jobId}] Progress: 75%`);

      } else if (type === 'workflow') {
        // ワークフロー実行（ストリーミングモード使用）
        console.log(`⚙️  [JOB ${jobId}] Processing WORKFLOW job with STREAMING mode`);
        console.log(`   Inputs:`, JSON.stringify(input.inputs, null, 2));
        
        await updateJob(jobId, { progress: 25 });
        console.log(`📊 [JOB ${jobId}] Progress: 25% - Starting workflow streaming...`);
        
        // ストリーミングログを保存する配列
        const streamingLogs: Array<{
          timestamp: string;
          event: string;
          data?: any;
        }> = [];

        let eventCount = 0;
        const streamStartTime = Date.now();

        // ストリーミングモードで実行（長時間処理対応）
        result = await difyClient.runWorkflowStreaming({
          inputs: input.inputs,
          user: userId,
          jobId: jobId,
          onProgress: async (progress: number) => {
            // 進捗を更新（25% + ストリーミング進捗の50%）
            const newProgress = 25 + Math.floor(progress * 0.5);
            await updateJob(jobId, { progress: newProgress });
            
            if (eventCount % 50 === 0) {
              const elapsed = ((Date.now() - streamStartTime) / 1000).toFixed(1);
              console.log(`📊 [JOB ${jobId}] Progress: ${newProgress}% (${eventCount} events, ${elapsed}s elapsed)`);
            }
          },
          onEvent: async (event: any) => {
            eventCount++;
            
            // イベントをログに追加
            streamingLogs.push({
              timestamp: event.timestamp,
              event: event.event,
              data: event,
            });
            
            // 重要なイベントをログに記録
            if (event.event === 'workflow_started') {
              console.log(`🚀 [JOB ${jobId}] Workflow started on Dify`);
            } else if (event.event === 'workflow_finished') {
              console.log(`✅ [JOB ${jobId}] Workflow finished on Dify`);
            } else if (event.event.includes('error')) {
              console.error(`❌ [JOB ${jobId}] Error event:`, event);
            }
            
            // ジョブにストリーミングログを保存
            // 書き込み頻度を大幅に削減: 100イベントごと、または重要なイベント時のみ
            const shouldSave = 
              streamingLogs.length % 100 === 0 || 
              event.event === 'workflow_finished' ||
              event.event === 'workflow_started' ||
              event.event.includes('error');
            
            if (shouldSave) {
              try {
                // 非同期で保存（処理をブロックしない）
                updateJob(jobId, { streamingLogs: [...streamingLogs] }).catch((error) => {
                  console.warn(`⚠️  [JOB ${jobId}] Background save failed (${streamingLogs.length} events): ${error.message}`);
                });
                
                if (streamingLogs.length % 100 === 0) {
                  console.log(`💾 [JOB ${jobId}] Saving ${streamingLogs.length} events to storage...`);
                }
              } catch (error: any) {
                console.warn(`⚠️  [JOB ${jobId}] Failed to initiate save: ${error.message}`);
              }
            }
          },
        });

        const streamElapsed = ((Date.now() - streamStartTime) / 1000).toFixed(1);
        console.log(`✓ [JOB ${jobId}] Workflow streaming completed in ${streamElapsed}s`);
        console.log(`   Total events received: ${eventCount}`);

        // 接続が途中で切断された場合の処理
        if (result.note && result.note.includes('interrupted')) {
          console.warn(`⚠️  [JOB ${jobId}] Stream was interrupted. Marking as partial success.`);
          console.warn(`   Events received before interruption: ${eventCount}`);
          
          // 注意メッセージを含めて完了扱い
          result.warning = 'The streaming connection was interrupted due to network timeout. The workflow likely completed on Dify, but we could not receive the final result.';
          result.suggestion = 'Check your Dify dashboard to verify the workflow status.';
        }

        // 最終的にすべてのログを保存
        console.log(`💾 [JOB ${jobId}] Saving final state with ${streamingLogs.length} events...`);
        await updateJob(jobId, { 
          progress: 75,
          streamingLogs: streamingLogs,
        });
        console.log(`✓ [JOB ${jobId}] Final state saved`);
      } else if (type === 'completion') {
        // Completion実行
        console.log(`📝 [JOB ${jobId}] Processing COMPLETION job`);
        console.log(`   Inputs:`, JSON.stringify(input.inputs || { query: input.query }, null, 2));
        
        await updateJob(jobId, { progress: 25 });
        console.log(`📊 [JOB ${jobId}] Progress: 25%`);
        
        result = await difyClient.sendCompletion({
          inputs: input.inputs || { query: input.query },
          user: userId,
          responseMode: 'blocking',
        });

        console.log(`✓ [JOB ${jobId}] Completion response received`);
        await updateJob(jobId, { progress: 75 });
        console.log(`📊 [JOB ${jobId}] Progress: 75%`);
      }

      // 完了
      console.log(`💾 [JOB ${jobId}] Saving final result...`);
      await updateJob(jobId, {
        status: 'completed',
        progress: 100,
        result: result,
        completedAt: new Date().toISOString(),
      });

      const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log('='.repeat(80));
      console.log(`✅ [JOB COMPLETED] Job ${jobId}`);
      console.log(`   Total execution time: ${totalElapsed}s`);
      console.log(`   Status: completed`);
      console.log(`   Result keys: ${result ? Object.keys(result).join(', ') : 'none'}`);
      console.log('='.repeat(80));

    } catch (error: any) {
      const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      
      console.log('='.repeat(80));
      console.error(`❌ [JOB FAILED] Job ${jobId}`);
      console.error(`   Execution time before failure: ${totalElapsed}s`);
      console.error(`   Error type: ${error.constructor.name}`);
      console.error(`   Error message: ${error.message}`);
      console.error(`   Error code: ${error.code || 'N/A'}`);
      
      // より詳細なエラーメッセージを取得
      let errorMessage = error.message;
      let errorDetails: any = {
        type: error.constructor.name,
        message: error.message,
        code: error.code,
        timestamp: new Date().toISOString(),
      };
      
      // Axiosエラーの場合、レスポンスの詳細を取得
      if (error.response) {
        console.error(`   HTTP Status: ${error.response.status}`);
        console.error(`   Response data:`, error.response.data);
        console.error(`   Response headers:`, error.response.headers);
        
        errorDetails.httpStatus = error.response.status;
        errorDetails.responseData = error.response.data;
        
        // 504エラーの場合は分かりやすいメッセージ
        if (error.response.status === 504) {
          errorMessage = 'Dify API Timeout (504): The workflow is taking too long to complete. Please check your Dify workflow or try again later.';
        } else {
          errorMessage = `Dify API Error (${error.response.status}): ${
            JSON.stringify(error.response.data) || error.message
          }`;
        }
      } else if (error.request) {
        console.error(`   No response received from Dify API`);
        console.error(`   Request config:`, {
          method: error.config?.method,
          url: error.config?.url,
          baseURL: error.config?.baseURL,
        });
        
        errorDetails.noResponse = true;
        errorDetails.requestConfig = {
          method: error.config?.method,
          url: error.config?.url,
        };
        
        errorMessage = 'No response from Dify API. Check your network connection and API URL.';
      } else if (error.code === 'ECONNABORTED') {
        console.error(`   Connection aborted`);
        errorDetails.connectionAborted = true;
        errorMessage = 'Request timeout: The workflow is taking too long. Please check your Dify workflow configuration.';
      }

      // スタックトレースを記録
      if (error.stack) {
        console.error(`   Stack trace:`);
        console.error(error.stack);
      }
      
      console.log('='.repeat(80));

      // エラーを保存
      console.log(`💾 [JOB ${jobId}] Saving error state...`);
      await updateJob(jobId, {
        status: 'failed',
        errorMessage: errorMessage,
        result: {
          error: true,
          errorDetails: errorDetails,
        },
      });
      console.log(`✓ [JOB ${jobId}] Error state saved`);
      
    } finally {
      // アクティブジョブから削除
      activeJobs.delete(jobId);
      console.log(`🗑️  [JOB ${jobId}] Removed from active jobs`);
    }
  })();

  // アクティブジョブに追加
  activeJobs.set(jobId, jobPromise);

  // Promiseを返さない（非ブロッキング）
}

