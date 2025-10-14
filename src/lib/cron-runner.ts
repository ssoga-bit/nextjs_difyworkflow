// 環境変数を読み込む（最優先で実行）
import dotenv from 'dotenv';
import path from 'path';

// .env.local ファイルを読み込む
const envPath = path.resolve(process.cwd(), '.env.local');
console.log('[CRON RUNNER] Loading environment from:', envPath);
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('[CRON RUNNER] ❌ Failed to load .env.local:', result.error.message);
  console.log('[CRON RUNNER] Please ensure .env.local exists in the dify-app directory');
  process.exit(1);
} else {
  console.log('[CRON RUNNER] ✓ Environment variables loaded');
  console.log('[CRON RUNNER] DIFY_API_KEY:', process.env.DIFY_API_KEY ? '✓ Set' : '✗ Not set');
  console.log('[CRON RUNNER] DIFY_API_BASE_URL:', process.env.DIFY_API_BASE_URL ? '✓ Set' : '✗ Not set');
}

// 環境変数読み込み後に動的インポート
async function startCronRunner() {
  console.log('[CRON RUNNER] Starting...');
  
  // 環境変数が読み込まれた後にインポート
  const { scheduleFetchDifyLogs } = await import('./cron.js');
  
  // Cronジョブを開始
  scheduleFetchDifyLogs();
  
  console.log('[CRON RUNNER] Started successfully');
}

// 起動
startCronRunner().catch((error) => {
  console.error('[CRON RUNNER] Failed to start:', error);
  process.exit(1);
});

// プロセスを維持
process.on('SIGINT', () => {
  console.log('[CRON RUNNER] Shutting down...');
  process.exit(0);
});

