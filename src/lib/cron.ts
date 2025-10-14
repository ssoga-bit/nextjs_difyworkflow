import cron from 'node-cron';
import { difyClient } from './dify-client';
import { upsertLog } from './log-storage';

// 5分ごとにDifyログを取得
export const scheduleFetchDifyLogs = () => {
  // Cron: 5分ごと（*/5 * * * *）
  const task = cron.schedule('*/5 * * * *', async () => {
    console.log('[CRON] Running scheduled task: Fetch Dify logs');
    
    try {
      await fetchAndStoreDifyLogs();
      console.log('[CRON] Dify logs fetched successfully');
    } catch (error) {
      console.error('[CRON] Error fetching Dify logs:', error);
    }
  });

  console.log('[CRON] Cron job scheduled: Fetch Dify logs every 5 minutes');
  
  return task;
};

// Difyログ取得＆保存処理
export async function fetchAndStoreDifyLogs() {
  const userId = 'system'; // システムユーザー

  try {
    // 注意: この機能はチャットアプリ専用です。
    // ワークフローアプリには会話の概念がないため、スキップします。
    console.log('[CRON] Note: Log fetching is only available for Chat Apps, not Workflow Apps');
    
    // 1. 会話一覧を取得
    const conversations = await difyClient.getConversations({
      user: userId,
      limit: 50,
    });

    if (!conversations.data || conversations.data.length === 0) {
      console.log('[CRON] No conversations found');
      return;
    }

    let messageCount = 0;

    // 2. 各会話のメッセージを取得
    for (const conversation of conversations.data) {
      const messages = await difyClient.getMessages({
        conversationId: conversation.id,
        user: userId,
        limit: 50,
      });

      if (!messages.data || messages.data.length === 0) {
        continue;
      }

      // 3. メッセージをJSONファイルに保存（重複チェック）
      for (const message of messages.data) {
        try {
          await upsertLog({
            difyLogId: message.id,
            logType: 'message',
            content: message,
            userId: conversation.user_id || userId,
            status: message.status || 'unknown',
            createdAt: new Date(message.created_at * 1000).toISOString(),
            fetchedAt: new Date().toISOString(),
          });
          messageCount++;
        } catch (error) {
          console.error(`[CRON] Error saving message ${message.id}:`, error);
        }
      }
    }

    console.log(`[CRON] Fetched and stored ${messageCount} messages from ${conversations.data.length} conversations`);

  } catch (error: any) {
    // ワークフローアプリの場合は "not_chat_app" エラーが予想されるため、無視
    if (error?.response?.data?.code === 'not_chat_app') {
      console.log('[CRON] Skipping log fetch: This is a Workflow App (not a Chat App)');
      console.log('[CRON] Log fetching is only available for Chat/Agent Apps');
      return; // エラーを投げずに正常終了
    }
    
    console.error('[CRON] Error in fetchAndStoreDifyLogs:', error);
    throw error;
  }
}

