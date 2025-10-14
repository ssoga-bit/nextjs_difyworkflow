import axios, { AxiosInstance } from 'axios';

export interface DifyConfig {
  apiKey: string;
  baseURL: string;
}

export class DifyClient {
  private client: AxiosInstance;

  constructor(config: DifyConfig) {
    this.client = axios.create({
      baseURL: config.baseURL,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 7200000, // 2時間（超長時間処理用: 7200000ms = 2時間）
    });
  }

  // メッセージ送信（ストリーミング対応）
  async sendMessage(params: {
    query: string;
    user: string;
    conversationId?: string;
    inputs?: Record<string, any>;
    responseMode?: 'blocking' | 'streaming';
  }) {
    const payload = {
      query: params.query,
      user: params.user,
      conversation_id: params.conversationId,
      inputs: params.inputs || {},
      response_mode: params.responseMode || 'blocking',
    };
    
    console.log('📤 [DIFY API] Sending chat message request');
    console.log(`   Endpoint: POST /chat-messages`);
    console.log(`   Query: "${payload.query}"`);
    console.log(`   User: ${payload.user}`);
    console.log(`   Conversation ID: ${payload.conversation_id || 'new'}`);
    
    const requestStartTime = Date.now();
    const response = await this.client.post('/chat-messages', payload);
    const requestElapsed = ((Date.now() - requestStartTime) / 1000).toFixed(2);
    
    console.log(`📥 [DIFY API] Chat response received in ${requestElapsed}s`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Response keys: ${Object.keys(response.data).join(', ')}`);
    
    return response.data;
  }

  // ストリーミングメッセージ送信
  async sendMessageStream(params: {
    query: string;
    user: string;
    conversationId?: string;
    inputs?: Record<string, any>;
  }) {
    const response = await this.client.post(
      '/chat-messages',
      {
        query: params.query,
        user: params.user,
        conversation_id: params.conversationId,
        inputs: params.inputs || {},
        response_mode: 'streaming',
      },
      {
        responseType: 'stream',
      }
    );
    return response.data;
  }

  // メッセージ一覧取得（ログ取得用）
  async getMessages(params: {
    conversationId?: string;
    user: string;
    limit?: number;
    firstId?: string;
  }) {
    const response = await this.client.get('/messages', {
      params: {
        conversation_id: params.conversationId,
        user: params.user,
        limit: params.limit || 20,
        first_id: params.firstId,
      },
    });
    return response.data;
  }

  // 会話一覧取得
  async getConversations(params: {
    user: string;
    limit?: number;
    lastId?: string;
  }) {
    const response = await this.client.get('/conversations', {
      params: {
        user: params.user,
        limit: params.limit || 20,
        last_id: params.lastId,
      },
    });
    return response.data;
  }

  // ワークフロー実行（blocking mode - 短時間処理用）
  async runWorkflow(params: {
    inputs: Record<string, any>;
    user: string;
    responseMode?: 'blocking' | 'streaming';
  }) {
    const payload = {
      inputs: params.inputs,
      user: params.user,
      response_mode: params.responseMode || 'blocking',
    };
    
    console.log('📤 [DIFY API] Sending workflow (blocking) request');
    console.log(`   Endpoint: POST /workflows/run`);
    console.log(`   Inputs:`, JSON.stringify(payload.inputs, null, 2));
    console.log(`   User: ${payload.user}`);
    console.log(`   Mode: blocking`);
    
    const requestStartTime = Date.now();
    const response = await this.client.post('/workflows/run', payload);
    const requestElapsed = ((Date.now() - requestStartTime) / 1000).toFixed(2);
    
    console.log(`📥 [DIFY API] Workflow response received in ${requestElapsed}s`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Response keys: ${Object.keys(response.data).join(', ')}`);
    
    return response.data;
  }

  // ワークフロー実行（streaming mode - 長時間処理用）
  async runWorkflowStreaming(params: {
    inputs: Record<string, any>;
    user: string;
    jobId?: string;
    onProgress?: (progress: number) => void;
    onEvent?: (event: any) => void;
  }): Promise<any> {
    const payload = {
      inputs: params.inputs,
      user: params.user,
      response_mode: 'streaming',
    };
    
    console.log('='.repeat(60));
    console.log('📤 [DIFY API] Sending workflow STREAMING request');
    console.log(`   Endpoint: POST /workflows/run`);
    console.log(`   Inputs:`, JSON.stringify(payload.inputs, null, 2));
    console.log(`   User: ${payload.user}`);
    console.log(`   Mode: STREAMING (for long-running workflows)`);
    console.log(`   Job ID: ${params.jobId || 'unknown'}`);
    console.log('='.repeat(60));
    
    return new Promise(async (resolve, reject) => {
      try {
        const response = await this.client.post('/workflows/run', payload, {
          responseType: 'stream',
        });

        let buffer = '';
        let finalResult: any = null;
        let eventCount = 0;
        let collectedText = ''; // テキストチャンクを収集
        let allEvents: any[] = []; // すべてのイベントを保存

        response.data.on('data', (chunk: Buffer) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          
          // 最後の不完全な行を保持
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.trim() === '' || !line.startsWith('data: ')) continue;
            
            try {
              const data = JSON.parse(line.slice(6)); // "data: " を除去
              eventCount++;
              allEvents.push(data); // すべてのイベントを保存
              
              console.log(`📥 [Stream ${params.jobId || 'unknown'}] Event ${eventCount}:`, {
                event: data.event,
                workflow_run_id: data.workflow_run_id,
              });

              // イベントをコールバックで通知
              if (params.onEvent) {
                params.onEvent({
                  eventNumber: eventCount,
                  timestamp: new Date().toISOString(),
                  ...data,
                });
              }

              // 進捗を報告（イベント数に基づいて概算）
              if (params.onProgress && eventCount % 5 === 0) {
                const estimatedProgress = Math.min(0.9, eventCount * 0.05);
                params.onProgress(estimatedProgress);
              }

              // テキストチャンクを収集
              if (data.event === 'text_chunk' && data.data?.text) {
                collectedText += data.data.text;
              }

              // 最終結果を保存
              if (data.event === 'workflow_finished') {
                finalResult = data;
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE data:', line);
            }
          }
        });

        response.data.on('end', () => {
          console.log('='.repeat(60));
          console.log(`✅ [DIFY STREAM COMPLETED] Job: ${params.jobId || 'unknown'}`);
          console.log(`   Total events: ${eventCount}`);
          console.log(`   Collected text: ${collectedText.length} characters`);
          console.log(`   Has workflow_finished event: ${!!finalResult}`);
          console.log('='.repeat(60));
          
          // 最終結果を構築
          const result = {
            success: true,
            workflow_run_id: finalResult?.workflow_run_id || allEvents[0]?.workflow_run_id,
            total_events: eventCount,
            text_output: collectedText || '(No text output)',
            workflow_data: finalResult?.data || {},
            completed_at: new Date().toISOString(),
            ...(finalResult || {}),
          };
          
          console.log(`📥 [Stream ${params.jobId || 'unknown'}] Final result prepared:`, {
            text_length: collectedText.length,
            has_workflow_data: !!finalResult?.data,
          });
          
          resolve(result);
        });

        response.data.on('error', (error: Error) => {
          console.log('='.repeat(60));
          console.error(`❌ [DIFY STREAM ERROR] Job: ${params.jobId || 'unknown'}`);
          console.error(`   Error: ${error.message}`);
          console.error(`   Error code: ${(error as any).code || 'N/A'}`);
          console.error(`   Events received before error: ${eventCount}`);
          console.error(`   Collected text: ${collectedText.length} characters`);
          console.log('='.repeat(60));
          
          // 接続エラーの場合、部分的な結果で解決（エラーではなく警告として扱う）
          if (error.message === 'aborted' || (error as any).code === 'ECONNRESET') {
            console.log(`📥 [Stream ${params.jobId || 'unknown'}] Treating as partial success due to network timeout`);
            resolve({
              success: true,
              message: 'Workflow streaming interrupted (network timeout)',
              events_received: eventCount,
              partial_result: finalResult,
              note: 'Connection was interrupted. The workflow may still be running on Dify.',
            });
          } else {
            reject(error);
          }
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  // Completion実行
  async sendCompletion(params: {
    inputs: Record<string, any>;
    user: string;
    responseMode?: 'blocking' | 'streaming';
  }) {
    const payload = {
      inputs: params.inputs,
      user: params.user,
      response_mode: params.responseMode || 'blocking',
    };
    
    console.log('📤 Sending completion request to Dify API:', {
      endpoint: '/completion-messages',
      payload: payload,
    });
    
    const response = await this.client.post('/completion-messages', payload);
    
    console.log('📥 Dify API completion response received:', {
      status: response.status,
      dataKeys: Object.keys(response.data),
    });
    
    return response.data;
  }

  // メッセージフィードバック
  async messageFeedback(params: {
    messageId: string;
    rating: 'like' | 'dislike';
    user: string;
  }) {
    const response = await this.client.post(`/messages/${params.messageId}/feedbacks`, {
      rating: params.rating,
      user: params.user,
    });
    return response.data;
  }
}

// シングルトンインスタンス
const apiKey = process.env.DIFY_API_KEY;
const baseURL = process.env.DIFY_API_BASE_URL;

// 環境変数の確認
if (!apiKey || !baseURL) {
  console.error('❌ Dify API configuration missing!');
  console.error('DIFY_API_KEY:', apiKey ? '✓ Set' : '✗ Not set');
  console.error('DIFY_API_BASE_URL:', baseURL ? '✓ Set' : '✗ Not set');
  throw new Error('Dify API configuration is missing. Please check your .env.local file.');
}

console.log('✓ Dify API Client initialized');
console.log('  Base URL:', baseURL);
console.log('  API Key:', apiKey.substring(0, 10) + '...');

export const difyClient = new DifyClient({
  apiKey: apiKey!,
  baseURL: baseURL!,
});

