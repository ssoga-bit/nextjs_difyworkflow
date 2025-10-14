# 🚀 Dify Long-Running Workflow App

Next.js アプリケーション - Dify の長時間実行ワークフローに対応したリアルタイム処理システム

## ✨ 特徴

- ✅ **長時間ワークフロー対応** - 1時間以上のタスクも安定して実行
- ✅ **ログ表示** - ポーリング方式（5秒更新）でログを表示
- ✅ **ブラウザ再接続対応** - 実行中にブラウザを閉じても処理継続、再接続時に状態復元
- ✅ **堅牢なエラーハンドリング** - リトライ機構とエラーログの詳細表示
- ✅ **ファイル破損防止** - アトミック書き込みと書き込みキューシステム
- ✅ **Vercelデプロイ対応** - ポーリング方式で実行時間制限をクリア
- ✅ **モダンUI** - Tailwind CSS によるレスポンシブデザイン

## 🏗️ 技術スタック

- **フレームワーク:** Next.js 15 (App Router)
- **言語:** TypeScript
- **スタイリング:** Tailwind CSS
- **API統合:** Dify API (Chat, Workflow, Completion)
- **更新方式:** ポーリング（5秒間隔）- Vercelデプロイ対応
- **ストレージ:** ローカルファイル（本番環境ではRedis/PostgreSQL推奨）

## 📋 前提条件

- Node.js 18以上
- npm または yarn
- Dify アカウント & API キー

## 🚀 クイックスタート

### 1. プロジェクトのクローン

```bash
git clone https://github.com/YOUR_USERNAME/dify-app.git
cd dify-app
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 環境変数の設定

`.env.local` ファイルを作成：

```env
DIFY_API_KEY="app-xxxxxxxxxxxxxxxxxx"
DIFY_API_BASE_URL="https://api.dify.ai/v1"
NODE_ENV="development"
```

### 4. 開発サーバーの起動

```bash
# Next.js と Cron Job を両方起動
npm run dev:all

# または個別に起動
npm run dev      # Next.js のみ
npm run dev:cron # Cron Job のみ
```

### 5. ブラウザでアクセス

```
http://localhost:3000
```

## 📁 プロジェクト構造

```
dify-app/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx           # トップページ（ジョブ作成）
│   │   ├── jobs/
│   │   │   ├── page.tsx       # ジョブ一覧
│   │   │   └── [id]/
│   │   │       └── page.tsx   # ジョブ詳細（リアルタイム表示）
│   │   └── api/
│   │       ├── jobs/
│   │       │   ├── route.ts         # 全ジョブ取得
│   │       │   ├── start/route.ts   # ジョブ作成
│   │       │   ├── stream/route.ts  # SSE エンドポイント
│   │       │   └── [id]/route.ts    # 個別ジョブ取得/削除
│   │       └── jobs/reset/route.ts  # データリセット
│   └── lib/
│       ├── dify-client.ts           # Dify API クライアント
│       ├── storage.ts               # ファイルストレージ（開発環境）
│       ├── storage-redis.ts         # Redis ストレージ（本番環境）
│       ├── job-processor.ts         # ジョブ処理ロジック
│       ├── cron.ts                  # Cron Job 定義
│       └── cron-runner.ts           # Cron Job 実行
├── data/                      # ローカルストレージ（開発環境のみ）
│   ├── jobs/
│   │   └── job-xxx.json      # 個別ジョブファイル
│   └── jobs-index.json       # ジョブインデックス
├── DEPLOYMENT_GUIDE.md       # 詳細なデプロイガイド
├── QUICK_DEPLOY.md           # クイックデプロイガイド
└── README.md                 # このファイル
```

## 🎯 主な機能

### 1. ジョブ作成
- Dify アプリタイプ選択（Chat, Workflow, Completion）
- クエリ入力
- バックグラウンド処理の開始

### 2. リアルタイム監視
- SSE によるライブログ更新
- プログレスバー表示
- ストリーミングイベントの詳細表示
- 自動スクロール機能

### 3. ジョブ管理
- ジョブ一覧表示
- ステータスフィルタ（All, Processing, Completed, Failed, Pending）
- 自動更新（5秒ごと）
- ジョブ詳細へのナビゲーション

### 4. エラーハンドリング
- Dify API エラーの詳細表示
- リトライ機構
- ユーザーフレンドリーなエラーメッセージ
- デバッグ情報パネル

## 🔧 開発コマンド

```bash
# 開発サーバー起動（Turbopack使用）
npm run dev

# Cron Job 起動
npm run dev:cron

# 両方を同時起動
npm run dev:all

# ビルド
npm run build

# 本番モード起動
npm start

# リンター実行
npm run lint
```

## 📦 Vercel へのデプロイ

> ⚠️ **重要:** このアプリは現在ローカルファイルストレージを使用しています。  
> Vercel にデプロイする前に、**データベース（Redis または PostgreSQL）への移行が必須**です。

### クイックデプロイ（30分）

詳細は [`QUICK_DEPLOY.md`](./QUICK_DEPLOY.md) を参照してください。

**手順概要:**
1. Upstash Redis でデータベース作成
2. `storage-redis.ts` に切り替え
3. GitHub にプッシュ
4. Vercel で環境変数を設定
5. デプロイ

### 詳細なデプロイガイド

本格的な本番環境構築については [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md) を参照してください。

**含まれる内容:**
- データベース移行の詳細
- Vercel 設定
- 長時間ワークフローの対応方法
- Cron Jobs の設定
- トラブルシューティング

## 🔐 環境変数

| 変数名 | 説明 | 必須 |
|--------|------|------|
| `DIFY_API_KEY` | Dify API キー | ✅ |
| `DIFY_API_BASE_URL` | Dify API ベースURL | ✅ |
| `NODE_ENV` | 環境（development/production） | ✅ |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL（本番環境） | ⚠️ |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis Token（本番環境） | ⚠️ |

## 🧪 動作確認済み環境

- ✅ Node.js 22.19.0
- ✅ Windows 10/11
- ✅ macOS
- ✅ Linux
- ✅ Vercel（Redis使用時）

## 📊 パフォーマンス

### ローカル環境
- ✅ 51分の長時間ワークフロー完全対応
- ✅ 1,000以上のストリーミングイベント処理
- ✅ ファイル破損ゼロ（書き込みキュー実装）

### Vercel 環境
- ✅ ポーリング方式で実行時間制限をクリア（各リクエスト<1秒）
- ✅ Hobby/Proプランどちらでも動作
- ⚠️ データベース移行が必要（Upstash Redis推奨）

## 🐛 トラブルシューティング

### ファイル破損エラー

```
Error: Unexpected non-whitespace character after JSON
```

**解決策:**
- データをリセット: `POST http://localhost:3000/api/jobs/reset`
- または、`data/` ディレクトリを削除

### タイムアウトエラー

```
Error: Request failed with status code 504
```

**解決策:**
- ストリーミングモードが有効か確認
- Dify ワークフローの実行時間を確認
- ネットワーク接続を確認

### ポーリングが停止する

**症状:**
- ログが更新されない
- ジョブがprocessingのまま

**解決策:**
- ブラウザをリフレッシュ（F5）
- `localStorage.clear()` を実行
- サーバーを再起動

## 📚 参考資料

- [Dify Documentation](https://docs.dify.ai/)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Next.js Data Fetching](https://nextjs.org/docs/app/building-your-application/data-fetching)
- [Vercel Documentation](https://vercel.com/docs)
- [Vercel関数の制限](https://vercel.com/docs/functions/serverless-functions/runtimes#max-duration)
- [Upstash Redis](https://upstash.com/docs/redis)

## 🤝 コントリビューション

プルリクエストを歓迎します！

1. フォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/AmazingFeature`)
3. コミット (`git commit -m 'Add some AmazingFeature'`)
4. プッシュ (`git push origin feature/AmazingFeature`)
5. プルリクエストを作成

## 📄 ライセンス

MIT License

## 👤 作成者

プロジェクトに関する質問は Issue を作成してください。

## 🙏 謝辞

- [Dify](https://dify.ai) - 強力なLLMOpsプラットフォーム
- [Next.js](https://nextjs.org) - 最高のReactフレームワーク
- [Vercel](https://vercel.com) - 素晴らしいホスティングサービス

---

**🌟 このプロジェクトが役に立ったら、ぜひスターをお願いします！**
