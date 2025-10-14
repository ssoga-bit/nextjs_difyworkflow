# Vercelデプロイ手順書

## 📋 目次
1. [重要な注意事項](#重要な注意事項)
2. [デプロイ前の準備](#デプロイ前の準備)
3. [データベース移行（必須）](#データベース移行必須)
4. [Vercelプロジェクト設定](#vercelプロジェクト設定)
5. [環境変数の設定](#環境変数の設定)
6. [デプロイ実行](#デプロイ実行)
7. [デプロイ後の確認](#デプロイ後の確認)
8. [トラブルシューティング](#トラブルシューティング)

---

## ⚠️ 重要な注意事項

### **現在のアーキテクチャの制限**

このアプリケーションは現在、**ローカルファイルストレージ**を使用しています：

```
data/
├── jobs/
│   └── job-xxx.json  ← ローカルファイル
└── jobs-index.json   ← ローカルファイル
```

**問題点:**
- ❌ Vercelは**読み取り専用ファイルシステム**
- ❌ `/tmp` ディレクトリのみ書き込み可能だが、デプロイごとにリセットされる
- ❌ Cron jobsがVercelでは異なる方式で動作する
- ❌ 複数のサーバーレス関数インスタンス間でデータ共有不可

### **必須の対応**

✅ **データベースへの移行が必須**

以下のいずれかのデータベースに移行する必要があります：
- **PostgreSQL** (推奨: Vercel Postgres, Supabase)
- **MongoDB** (MongoDB Atlas)
- **Redis** (Upstash Redis - 最も簡単)
- **Prisma** + PostgreSQL

### **✅ ポーリング方式への変更完了**

**良いニュース:** このアプリケーションは既に**ポーリング方式**に変更されています！

**変更内容:**
- ❌ SSE（Server-Sent Events）- 長時間接続（Vercel非対応）
- ✅ **ポーリング方式** - 5秒ごとにREST API呼び出し（Vercel対応）

**メリット:**
- ✅ 各HTTPリクエストは1秒未満で完了
- ✅ Vercel Hobby/Proプランどちらでも動作
- ✅ 実行時間制限を完全にクリア

詳細は `POLLING_MIGRATION.md` を参照してください。

---

## 🚀 デプロイ前の準備

### **ステップ1: Vercelアカウントの作成**

1. [Vercel](https://vercel.com) にアクセス
2. GitHubアカウントでサインアップ
3. アカウント作成完了

### **ステップ2: GitHubリポジトリの準備**

```bash
# GitHubに新しいリポジトリを作成し、プッシュ
cd dify-app
git init
git add .
git commit -m "Initial commit: Dify Next.js App"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/dify-app.git
git push -u origin main
```

### **ステップ3: Vercel CLIのインストール（オプション）**

```bash
npm install -g vercel

# ログイン
vercel login
```

---

## 🗄️ データベース移行（必須）

Vercelにデプロイする前に、ファイルストレージをデータベースに移行する必要があります。

### **オプション1: Vercel Postgres（推奨）**

#### **1. Vercel Postgresのセットアップ**

1. [Vercel Dashboard](https://vercel.com/dashboard) にアクセス
2. "Storage" タブをクリック
3. "Create Database" → "Postgres" を選択
4. データベース名を入力して作成
5. 接続情報をコピー

#### **2. 依存関係のインストール**

```bash
npm install @vercel/postgres
```

#### **3. データベーススキーマの作成**

`sql/schema.sql` を作成：

```sql
-- ジョブテーブル
CREATE TABLE jobs (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  query TEXT,
  progress INTEGER DEFAULT 0,
  result JSONB,
  error_message TEXT,
  streaming_logs JSONB,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP
);

-- インデックス
CREATE INDEX idx_jobs_user_id ON jobs(user_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_created_at ON jobs(created_at DESC);
```

#### **4. ストレージ層の書き換え**

`src/lib/storage-postgres.ts` を作成：

```typescript
import { sql } from '@vercel/postgres';
import { Job } from './storage';

export async function createJob(job: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>): Promise<Job> {
  const newJob: Job = {
    ...job,
    id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await sql`
    INSERT INTO jobs (id, user_id, type, status, query, progress, result, error_message, streaming_logs, created_at, updated_at, completed_at)
    VALUES (${newJob.id}, ${newJob.userId}, ${newJob.type}, ${newJob.status}, ${newJob.query || null}, ${newJob.progress}, ${JSON.stringify(newJob.result || {})}, ${newJob.errorMessage || null}, ${JSON.stringify(newJob.streamingLogs || [])}, ${newJob.createdAt}, ${newJob.updatedAt}, ${newJob.completedAt || null})
  `;

  return newJob;
}

export async function getJob(id: string): Promise<Job | null> {
  const result = await sql`
    SELECT * FROM jobs WHERE id = ${id}
  `;

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    status: row.status,
    query: row.query,
    progress: row.progress,
    result: row.result,
    errorMessage: row.error_message,
    streamingLogs: row.streaming_logs || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

export async function updateJob(id: string, updates: Partial<Job>): Promise<Job | null> {
  const currentJob = await getJob(id);
  if (!currentJob) return null;

  const updatedJob = {
    ...currentJob,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await sql`
    UPDATE jobs
    SET 
      status = ${updatedJob.status},
      progress = ${updatedJob.progress},
      result = ${JSON.stringify(updatedJob.result || {})},
      error_message = ${updatedJob.errorMessage || null},
      streaming_logs = ${JSON.stringify(updatedJob.streamingLogs || [])},
      updated_at = ${updatedJob.updatedAt},
      completed_at = ${updatedJob.completedAt || null}
    WHERE id = ${id}
  `;

  return updatedJob;
}

export async function getAllJobs(): Promise<Job[]> {
  const result = await sql`
    SELECT * FROM jobs ORDER BY created_at DESC
  `;

  return result.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    type: row.type,
    status: row.status,
    query: row.query,
    progress: row.progress,
    result: row.result,
    errorMessage: row.error_message,
    streamingLogs: row.streaming_logs || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  }));
}
```

#### **5. 既存コードの更新**

すべての `import { ... } from '@/lib/storage'` を  
`import { ... } from '@/lib/storage-postgres'` に変更

---

### **オプション2: Upstash Redis（高速・シンプル）**

#### **1. Upstashアカウント作成**

1. [Upstash](https://upstash.com) にアクセス
2. GitHubでサインアップ
3. Redis Database を作成
4. 接続情報をコピー

#### **2. 依存関係のインストール**

```bash
npm install @upstash/redis
```

#### **3. Redis用ストレージ層の作成**

`src/lib/storage-redis.ts` を作成：

```typescript
import { Redis } from '@upstash/redis';
import { Job } from './storage';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function createJob(job: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>): Promise<Job> {
  const newJob: Job = {
    ...job,
    id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await redis.set(`job:${newJob.id}`, JSON.stringify(newJob));
  await redis.zadd('jobs:index', { score: Date.now(), member: newJob.id });

  return newJob;
}

export async function getJob(id: string): Promise<Job | null> {
  const data = await redis.get<string>(`job:${id}`);
  if (!data) return null;
  return JSON.parse(data);
}

export async function updateJob(id: string, updates: Partial<Job>): Promise<Job | null> {
  const currentJob = await getJob(id);
  if (!currentJob) return null;

  const updatedJob = {
    ...currentJob,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await redis.set(`job:${updatedJob.id}`, JSON.stringify(updatedJob));
  return updatedJob;
}

export async function getAllJobs(): Promise<Job[]> {
  const jobIds = await redis.zrange('jobs:index', 0, -1, { rev: true });
  const jobs: Job[] = [];

  for (const id of jobIds) {
    const job = await getJob(id as string);
    if (job) jobs.push(job);
  }

  return jobs;
}
```

---

## 🔧 Vercelプロジェクト設定

### **ステップ1: vercel.json の作成**

プロジェクトルートに `vercel.json` を作成：

```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["sin1"],
  "functions": {
    "src/app/api/**/*.ts": {
      "maxDuration": 300
    }
  },
  "env": {
    "DIFY_API_KEY": "@dify-api-key",
    "DIFY_API_BASE_URL": "@dify-api-base-url"
  }
}
```

**重要:** `maxDuration: 300` は Vercel Pro プラン以上で最大300秒（5分）まで設定可能。  
長時間ワークフロー（51分など）は**バックグラウンド処理**に変更する必要があります。

### **ステップ2: Cron Jobsの調整**

Vercelでは、Cron Jobsを `vercel.json` で定義します：

```json
{
  "crons": [
    {
      "path": "/api/cron/fetch-logs",
      "schedule": "0 */5 * * *"
    }
  ]
}
```

`src/app/api/cron/fetch-logs/route.ts` を作成：

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Vercel Cron Secret で認証
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ログフェッチ処理
  // ...

  return NextResponse.json({ success: true });
}
```

### **ステップ3: .vercelignore の作成**

```
node_modules
.next
.env.local
data
*.log
.DS_Store
```

---

## 🔐 環境変数の設定

### **Vercel Dashboardでの設定**

1. Vercelプロジェクトページにアクセス
2. "Settings" → "Environment Variables" をクリック
3. 以下の環境変数を追加：

| 変数名 | 値 | 環境 |
|--------|-----|------|
| `DIFY_API_KEY` | `app-xxxxxxxxxx` | Production, Preview, Development |
| `DIFY_API_BASE_URL` | `https://api.dify.ai/v1` | Production, Preview, Development |
| `POSTGRES_URL` | （Vercel Postgresから自動設定） | Production, Preview, Development |
| `CRON_SECRET` | （ランダムな文字列を生成） | Production, Preview, Development |

**CRON_SECRETの生成:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🚀 デプロイ実行

### **方法1: Vercel Dashboard（推奨）**

1. [Vercel Dashboard](https://vercel.com/new) にアクセス
2. "Import Project" をクリック
3. GitHubリポジトリを選択
4. プロジェクト設定を確認
5. "Deploy" をクリック

### **方法2: Vercel CLI**

```bash
# プロジェクトディレクトリで実行
cd dify-app

# デプロイ
vercel

# 本番環境にデプロイ
vercel --prod
```

### **方法3: GitHub連携（自動デプロイ）**

1. GitHubリポジトリにプッシュ
2. Vercelが自動的にデプロイを開始
3. プルリクエストごとにプレビュー環境が自動作成

```bash
git add .
git commit -m "Ready for Vercel deployment"
git push origin main
```

---

## ✅ デプロイ後の確認

### **1. デプロイURL確認**

デプロイ完了後、以下の形式のURLが発行されます：

```
https://your-project-name.vercel.app
```

### **2. 動作確認チェックリスト**

- [ ] トップページが表示される
- [ ] 新しいジョブを作成できる
- [ ] ジョブ一覧ページが表示される
- [ ] ジョブ詳細ページが表示される
- [ ] リアルタイムログが更新される
- [ ] ジョブが完了する
- [ ] 環境変数が正しく設定されている

### **3. ログの確認**

```bash
# Vercel CLIでログを確認
vercel logs
```

または、Vercel Dashboard → "Deployments" → "Logs" で確認

---

## ⚙️ 長時間ワークフローの対応

✅ **既に対応済み！** このアプリは**ポーリング方式**を使用しているため、長時間ワークフローに完全対応しています。

### **アーキテクチャ:**

```
ブラウザ (クライアント)
    ↓ 5秒ごとにポーリング（各リクエスト<1秒）
Vercel API (/api/jobs/[id])
    ↓ データベースから取得
データベース (Redis/Postgres)
    ↑ バックグラウンドで更新
バックグラウンドプロセス (Next.js サーバー)
    ↓ Dify APIと通信（51分）
Dify API
```

### **Vercelの実行時間制限:**

| プラン | 最大実行時間 | 対応状況 |
|--------|-------------|---------|
| Hobby | 10秒 | ✅ 対応（ポーリング各リクエスト<1秒） |
| Pro | 300秒（5分） | ✅ 対応（ポーリング各リクエスト<1秒） |
| Enterprise | カスタム | ✅ 対応 |

**重要:** バックグラウンドプロセス（Dify APIとの通信）は、ローカル環境または外部ワーカーで実行する必要があります。

### **本番環境での推奨構成:**

#### **オプション1: Dify Webhook（最も簡単・推奨）**

Difyがワークフロー完了時にWebhookでVercelに通知：

```
Dify Workflow (51分実行)
    ↓ 完了時
Webhook → Vercel API (/api/webhook/dify)
    ↓
データベース更新
    ↑ 5秒ごとにポーリング
ブラウザ
```

**メリット:**
- ✅ サーバー負荷ゼロ
- ✅ 完全にリアルタイム
- ✅ 追加コストなし

#### **Upstash QStashの使用例:**

```bash
npm install @upstash/qstash
```

```typescript
// src/app/api/jobs/start/route.ts
import { Client } from '@upstash/qstash';

const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
});

export async function POST(request: NextRequest) {
  // ジョブをキューに追加
  await qstash.publishJSON({
    url: `${process.env.VERCEL_URL}/api/jobs/process`,
    body: { jobId: newJob.id },
  });

  return NextResponse.json({ job: newJob });
}
```

---

## 🔧 トラブルシューティング

### **問題1: ファイルストレージエラー**

**エラー:**
```
Error: EROFS: read-only file system
```

**解決:**
- データベースへの移行が完了しているか確認
- `src/lib/storage.ts` への参照がすべて `storage-postgres.ts` または `storage-redis.ts` に変更されているか確認

---

### **問題2: タイムアウトエラー**

**エラー:**
```
Error: Function execution timed out after 10s
```

**解決:**
- Vercel Proプランにアップグレード
- または、バックグラウンドジョブシステム（QStash等）に移行

---

### **問題3: 環境変数が読み込まれない**

**解決:**
- Vercel Dashboardで環境変数が設定されているか確認
- 環境変数を追加後、再デプロイが必要

```bash
vercel --prod
```

---

### **問題4: Cron Jobsが動作しない**

**解決:**
- `vercel.json` に `crons` 設定が含まれているか確認
- Cron Secret が正しく設定されているか確認
- Vercel Dashboardの "Cron Jobs" タブで実行履歴を確認

---

## 📚 参考リンク

- [Vercel公式ドキュメント](https://vercel.com/docs)
- [Next.js on Vercel](https://vercel.com/docs/frameworks/nextjs)
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
- [Upstash Redis](https://upstash.com/docs/redis)
- [Upstash QStash](https://upstash.com/docs/qstash)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)

---

## 🎯 推奨デプロイフロー

### **短期的（クイックデプロイ）:**

1. ✅ Upstash Redisに移行（最も簡単）
2. ✅ 環境変数を設定
3. ✅ Vercelにデプロイ
4. ⚠️ 長時間ワークフローは制限あり（5分まで）

### **長期的（本格運用）:**

1. ✅ Vercel Postgresに移行（スケーラブル）
2. ✅ Upstash QStashでバックグラウンドジョブ実装
3. ✅ Vercel Pro プランにアップグレード
4. ✅ 監視・ロギングシステム導入（Sentry等）

---

## 📞 サポート

問題が発生した場合：
1. [Vercel Community](https://github.com/vercel/vercel/discussions)
2. [Next.js Discussions](https://github.com/vercel/next.js/discussions)
3. プロジェクトのIssueトラッカー

---

**作成日:** 2025-10-14  
**バージョン:** 1.0

