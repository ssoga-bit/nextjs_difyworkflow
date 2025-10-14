# Changelog

## [1.1.0] - 2025-10-14

### ✨ 追加
- **ポーリング方式への移行** - SSEからポーリング方式に変更してVercelデプロイに対応
- **Upstash Redis サポート** - 本番環境用のRedisストレージ実装を追加
- **詳細なデプロイドキュメント** - `DEPLOYMENT_GUIDE.md`、`QUICK_DEPLOY.md`、`POLLING_MIGRATION.md`を作成

### 🔄 変更
- **クライアント側更新ロジック** - SSE → 5秒ごとのポーリングに変更
  - `src/app/jobs/[id]/page.tsx` - 主要な変更箇所
  - リアルタイム性: 即座 → 最大5秒遅延（許容範囲）
  - Vercel対応: 各HTTPリクエスト<1秒

- **ドキュメント更新**
  - `README.md` - ポーリング方式について記載
  - `DEPLOYMENT_GUIDE.md` - ポーリング対応を明記
  - `QUICK_DEPLOY.md` - 長時間ワークフロー対応状況を更新

### 🐛 修正
- **未使用インポート削除** - `useRef`を削除
- **HTMLエスケープ** - ダブルクォーテーションを適切にエスケープ
- **Upstash Redis API対応** - `zrangebyscore` → `zrange`に更新

### 📝 注記
- **SSE API** - `src/app/api/jobs/stream/route.ts`は削除せず保持（将来の参考用）
- **既存機能** - すべての機能（ログ表示、プログレスバー、エラーハンドリング等）は変更なし
- **パフォーマンス** - ローカル環境: 51分ワークフロー対応、Vercel環境: 制限なし

---

## [1.0.0] - 2025-10-14

### 🎉 初回リリース

- **長時間ワークフロー対応** - 51分以上のDifyワークフローを実行可能
- **リアルタイムログ表示** - Server-Sent Events (SSE)によるライブ更新
- **ブラウザ再接続対応** - 実行中にブラウザを閉じても処理継続
- **堅牢なエラーハンドリング** - リトライ機構とエラーログの詳細表示
- **ファイル破損防止** - アトミック書き込みと書き込みキューシステム
- **3種類のDifyアプリ対応** - Chat、Workflow、Completion
- **ローカルファイルストレージ** - 開発環境用データ永続化

### 主要ファイル
- `src/app/page.tsx` - ジョブ作成UI
- `src/app/jobs/page.tsx` - ジョブ一覧
- `src/app/jobs/[id]/page.tsx` - ジョブ詳細（リアルタイム表示）
- `src/lib/dify-client.ts` - Dify API クライアント
- `src/lib/storage.ts` - ローカルファイルストレージ
- `src/lib/job-processor.ts` - ジョブ処理ロジック

---

## フォーマット

このChangelog は [Keep a Changelog](https://keepachangelog.com/ja/1.0.0/) に基づいています。

### カテゴリ
- `追加` - 新機能
- `変更` - 既存機能の変更
- `非推奨` - 間もなく削除される機能
- `削除` - 削除された機能
- `修正` - バグ修正
- `セキュリティ` - 脆弱性対応

