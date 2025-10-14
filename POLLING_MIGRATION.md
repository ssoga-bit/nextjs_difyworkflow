# ポーリング方式への移行完了

## 📋 変更概要

**日時:** 2025-10-14  
**目的:** Vercelデプロイに対応するため、SSE（Server-Sent Events）からポーリング方式に変更

---

## 🔄 変更内容

### **1. クライアント側の変更**

**ファイル:** `src/app/jobs/[id]/page.tsx`

**変更前:**
- Server-Sent Events（SSE）でリアルタイム更新
- サーバー側との長時間接続を維持（最大51分）
- イベントベースの更新

**変更後:**
- **ポーリング方式**（5秒ごとにREST APIを呼び出し）
- 短時間のHTTPリクエスト（1秒未満）
- シンプルな実装

**具体的な変更:**
```typescript
// 変更前: SSE接続
const eventSource = new EventSource(`/api/jobs/stream?jobId=${jobId}`);
eventSource.onmessage = (event) => { ... };

// 変更後: ポーリング
const fetchJobStatus = async () => {
  const response = await fetch(`/api/jobs/${jobId}`);
  const jobData = await response.json();
  setJob(jobData);
};
const pollInterval = setInterval(fetchJobStatus, 5000);
```

---

### **2. Server-Sent Events APIの変更**

**ファイル:** `src/app/api/jobs/stream/route.ts`

**変更内容:**
- コードは削除せず保持
- ファイル先頭にコメントを追加: 「現在未使用」
- 将来の参考として残す

**理由:**
- 将来的にリアルタイム性を向上させる場合に参考になる
- Webhookやバックグラウンドワーカーへの移行時に有用

---

## 📊 比較: SSE vs ポーリング

| 項目 | SSE（変更前） | ポーリング（変更後） |
|------|---------------|---------------------|
| **リアルタイム性** | ⭐⭐⭐ 即座 | ⭐⭐ 最大5秒遅延 |
| **サーバー負荷** | 低（接続維持） | 中（定期的なリクエスト） |
| **実装の複雑さ** | ⭐⭐ 中 | ⭐ シンプル |
| **Vercel対応** | ❌ 不可（長時間接続） | ✅ 完全対応 |
| **接続時間** | 最大51分 | 各リクエスト<1秒 |
| **バッテリー消費** | 低 | 中（定期的な通信） |
| **エラー回復** | 自動再接続 | 次回ポーリングで回復 |

---

## ✅ Vercelデプロイへの影響

### **実行時間制限への対応**

**Vercelの制限:**
- Hobby: 最大10秒
- Pro: 最大300秒（5分）

**ポーリング方式:**
- 各HTTPリクエストは1秒未満 ✅
- 完全に制限内に収まる ✅

### **コスト**

**SSE方式:**
```
1ジョブ（51分） = 1接続 × 51分 = 長時間占有
```

**ポーリング方式:**
```
1ジョブ（51分） = 610リクエスト × 1秒 = 合計610秒の実行時間
51分 ÷ 5秒 = 612回のリクエスト
```

→ Vercelの無料枠内で十分対応可能

---

## 🎯 ユーザー体験への影響

### **変更点:**

1. **更新頻度**
   - 変更前: リアルタイム（即座）
   - 変更後: 5秒ごと
   - **影響:** 最大5秒の遅延（許容範囲）

2. **ログ表示**
   - 変更前: イベントが発生した瞬間に表示
   - 変更後: 5秒ごとに一括更新
   - **影響:** ほぼ同じ（ユーザーは気づかない）

3. **バッテリー消費**
   - 変更前: 低（接続維持のみ）
   - 変更後: 若干増加（定期的な通信）
   - **影響:** 微小

### **変更なし:**

- ✅ すべてのログが保存・表示される
- ✅ プログレスバーが更新される
- ✅ ジョブ完了が検知される
- ✅ エラーハンドリング
- ✅ 自動スクロール機能

---

## 🔧 今後の改善案

### **オプション1: Dify Webhook（推奨）**

**メリット:**
- ⭐⭐⭐ 完全にリアルタイム
- ⭐⭐⭐ サーバー負荷ゼロ
- ⭐⭐⭐ Vercel完全対応

**実装方法:**
```typescript
// /api/webhook/dify/route.ts
export async function POST(request: NextRequest) {
  const { workflow_run_id, status, output } = await request.json();
  await updateJob(jobId, { status: 'completed', result: output });
  return NextResponse.json({ success: true });
}
```

**Dify側の設定:**
- Webhook URL: `https://your-app.vercel.app/api/webhook/dify`
- イベント: Workflow Completed

---

### **オプション2: バックグラウンドワーカー**

**アーキテクチャ:**
```
Vercel (UI) → Queue (QStash) → Worker (Railway/Render) → Dify API
                                      ↓
                                   Database (Redis)
                                      ↑
Vercel (UI) ← Polling
```

**メリット:**
- 現在のSSE実装をほぼ維持
- どんなに長いワークフローでも対応
- スケーラブル

---

### **オプション3: ポーリング頻度の最適化**

**現在:** 5秒固定

**改善案:** アダプティブポーリング
```typescript
// ジョブが開始直後: 2秒ごと（頻繁）
// ジョブが長時間実行中: 10秒ごと（省エネ）
// ジョブが完了間近: 3秒ごと（頻繁）
```

---

## 🧪 テスト結果

### **動作確認:**
- ✅ ジョブ作成
- ✅ ポーリング開始（5秒ごと）
- ✅ ログ表示（最大5秒遅延）
- ✅ プログレスバー更新
- ✅ ジョブ完了検知
- ✅ ポーリング自動停止
- ✅ エラーハンドリング

### **パフォーマンス:**
- ✅ リントエラー: なし
- ✅ TypeScriptエラー: なし
- ✅ ビルドエラー: なし
- ✅ ブラウザエラー: なし

---

## 📝 変更ファイル一覧

1. ✅ `src/app/jobs/[id]/page.tsx` - SSE → ポーリングに変更
2. ✅ `src/app/api/jobs/stream/route.ts` - コメント追加（未使用表記）
3. ✅ `POLLING_MIGRATION.md` - このドキュメント

---

## 🚀 デプロイ手順

### **ステップ1: ローカルでテスト**

```bash
npm run dev:all
```

### **ステップ2: データベース移行**

`QUICK_DEPLOY.md` を参照して、Upstash Redisに移行

### **ステップ3: GitHubにプッシュ**

```bash
git add .
git commit -m "feat: migrate from SSE to polling for Vercel compatibility"
git push origin main
```

### **ステップ4: Vercelにデプロイ**

```bash
vercel --prod
```

---

## 📚 参考資料

- [Vercel関数の制限](https://vercel.com/docs/functions/serverless-functions/runtimes#max-duration)
- [Next.js ポーリングのベストプラクティス](https://nextjs.org/docs/app/building-your-application/data-fetching/fetching-caching-and-revalidating#revalidating-data)
- [Upstash QStash](https://upstash.com/docs/qstash)

---

**作成日:** 2025-10-14  
**バージョン:** 1.0  
**ステータス:** ✅ 完了

