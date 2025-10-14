# ⚡ Vercel クイックデプロイガイド

> **所要時間:** 約30分  
> **前提条件:** GitHubアカウント、Vercelアカウント

---

## 🚨 重要な前提条件

**このアプリは現在ローカルファイルストレージを使用しています。**  
Vercelにデプロイするには、**データベースへの移行が必須**です。

## ✅ 良いニュース

このアプリケーションは既に**ポーリング方式**に変更されているため、Vercelの実行時間制限をクリアしています！
- ✅ 各HTTPリクエストは1秒未満
- ✅ Hobby/Proプランどちらでも動作
- ✅ 長時間ワークフロー（51分）に対応

---

## 🎯 最速デプロイ手順（Upstash Redis使用）

### **ステップ1: Upstashでデータベース作成**

1. [Upstash](https://upstash.com) にアクセス
2. GitHubでサインアップ
3. "Create Database" → **Redis** を選択
4. リージョン: **Asia Pacific (Singapore)** を選択
5. データベース名: `dify-jobs`
6. 作成完了後、以下をコピー:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

### **ステップ2: Redis用ストレージをインストール**

```bash
cd dify-app
npm install @upstash/redis
```

### **ステップ3: Redis用ストレージファイルをダウンロード**

`src/lib/storage-redis.ts` を作成（内容は DEPLOYMENT_GUIDE.md を参照）

### **ステップ4: インポートを変更**

以下のファイルで `@/lib/storage` → `@/lib/storage-redis` に変更：

- `src/app/api/jobs/start/route.ts`
- `src/app/api/jobs/[id]/route.ts`
- `src/app/api/jobs/route.ts`
- `src/app/api/jobs/stream/route.ts`
- `src/lib/job-processor.ts`

**一括置換コマンド（PowerShell）:**

```powershell
Get-ChildItem -Path "src" -Recurse -Filter "*.ts" | ForEach-Object {
  (Get-Content $_.FullName) -replace "@/lib/storage'", "@/lib/storage-redis'" | Set-Content $_.FullName
}
```

### **ステップ5: GitHubにプッシュ**

```bash
git init
git add .
git commit -m "Ready for Vercel deployment with Redis"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/dify-app.git
git push -u origin main
```

### **ステップ6: Vercelでデプロイ**

1. [Vercel](https://vercel.com/new) にアクセス
2. "Import Git Repository" をクリック
3. GitHubリポジトリを選択
4. **環境変数を設定:**

   | 変数名 | 値 |
   |--------|-----|
   | `DIFY_API_KEY` | `app-xxxxxxxxxx` |
   | `DIFY_API_BASE_URL` | `https://api.dify.ai/v1` |
   | `UPSTASH_REDIS_REST_URL` | （ステップ1でコピーした値） |
   | `UPSTASH_REDIS_REST_TOKEN` | （ステップ1でコピーした値） |

5. "Deploy" をクリック

### **ステップ7: 動作確認**

デプロイ完了後、発行されたURLにアクセス：

```
https://your-project-name.vercel.app
```

---

## ✅ 長時間ワークフローへの対応

**既に対応済み！** ポーリング方式により、Vercelの実行時間制限を回避しています。

### **仕組み:**

```
ブラウザ → 5秒ごとにポーリング（各<1秒） → Vercel API → データベース
```

Vercelの実行時間制限：
- **Hobby:** 10秒 → ✅ 対応（各リクエスト<1秒）
- **Pro:** 300秒 → ✅ 対応（各リクエスト<1秒）

**51分のワークフローでも問題なし！**

### **注意: バックグラウンドプロセス**

Dify APIとの通信（51分）は、以下のいずれかで実行：

1. **ローカル環境** - 開発・テスト用
2. **外部ワーカー** - Railway、Render等
3. **Dify Webhook** - 最も簡単（推奨）

詳細は `DEPLOYMENT_GUIDE.md` を参照。

---

## 🔄 継続的デプロイ

GitHubにプッシュするたびに自動デプロイ：

```bash
git add .
git commit -m "Update feature"
git push origin main
```

Vercelが自動的にデプロイを開始します。

---

## 📊 デプロイ費用

| サービス | プラン | 月額 |
|---------|--------|------|
| Vercel | Hobby | 無料 |
| Vercel | Pro | $20 |
| Upstash Redis | Free | 無料（10,000コマンド/日） |
| Upstash Redis | Pay as you go | 従量課金 |

---

## 🆘 トラブルシューティング

### **エラー: "EROFS: read-only file system"**

→ ファイルストレージからRedisへの移行が完了していません

### **エラー: "Function execution timed out"**

→ Vercel Proプランにアップグレード、または外部ワーカーを使用

### **エラー: "Cannot connect to Redis"**

→ 環境変数が正しく設定されているか確認

---

## 📚 次のステップ

- [ ] 本番環境のモニタリング設定
- [ ] カスタムドメインの設定
- [ ] エラートラッキング（Sentry）
- [ ] パフォーマンス最適化

詳細は `DEPLOYMENT_GUIDE.md` を参照してください。

---

**🎉 デプロイ完了！**

