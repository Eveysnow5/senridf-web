# 千里同風株式会社 — 公式ウェブサイト

## ローカルプレビュー（デプロイ前の確認）

ファイルをブラウザで直接開くと一部のリンクが機能しません。必ずローカルサーバーを使用してください。

### 方法 1: VS Code の Live Server（推奨）

1. VS Code を開く
2. 拡張機能「Live Server」をインストール（未インストールの場合）
3. `index.html` を右クリック → **「Open with Live Server」**
4. ブラウザで `http://127.0.0.1:5500` が自動的に開きます

### 方法 2: Python（Node.js 不要）

```bash
# このフォルダで実行
python -m http.server 8000
# ブラウザで http://localhost:8000 を開く
```

### 方法 3: Node.js の http-server

```bash
npx http-server .
# ブラウザで http://localhost:8080 を開く
```

---

## ファイル構成

```
senridoufuu-web/
├── index.html                  ← ホームページ
├── about/
│   ├── index.html              ← チームページ
│   └── milestones.html         ← 沿革ページ
├── solutions/
│   ├── index.html              ← 製品・サービスページ
│   ├── demo.html               ← オンラインデモページ
│   └── blog/
│       └── index.html          ← ブログ一覧ページ
├── css/
│   └── main.css                ← 全スタイル
├── js/
│   └── main.js                 ← i18n・ナビ・アニメーション（翻訳データを含む）
├── assets/
│   └── images/                 ← 画像ファイルをここに配置
└── functions/api/              ← バックエンド（Cloudflare Pages Functions）
```

---

## コンテンツの更新方法

### テキスト（翻訳）の変更

`js/main.js` の冒頭にある `const T = { ja: {...}, zh: {...}, en: {...} }` 内の値を変更してください。

例：ミッションの日本語テキストを変更する場合
```js
// js/main.js の中
mission_title: 'ここを変更する',
```

### 画像の追加

1. 画像ファイルを `assets/images/` に配置
2. 対応する HTML ファイルの `product-card__placeholder` 部分を変更:

```html
<!-- 変更前 -->
<div class="product-card__placeholder">...</div>

<!-- 変更後 -->
<img src="/assets/images/product1.jpg" alt="製品名" style="width:100%;height:100%;object-fit:cover;">
```

### ブログ記事の追加

1. `solutions/blog/` に新しい HTML ファイルを作成（例: `first-post.html`）
2. `solutions/blog/index.html` のコメント内のブログアイテムテンプレートをコピーして記入

---

## デプロイ手順

### 手順 1: GitHub にコードをアップロード

1. GitHub で新しいリポジトリを作成（例: `senridoufuu-web`）
2. このフォルダをリポジトリにプッシュ:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/[your-username]/senridoufuu-web.git
git push -u origin main
```

### 手順 2: デプロイ（現行の構成）

本番サイト **https://www.senridf.com/** は **Cloudflare Pages** で配信しています。
デプロイは以下の二段構成です（詳細は `docs/tools/00-architecture.md`）:

```
自分の GitHub リポジトリ に push
  → GitHub Actions が同僚のリポジトリへ自動ミラー
  → 同僚の Cloudflare アカウントがビルドして公開
```

つまり **push しても即座には反映されません**。ミラーとビルドの完了を待つ必要があります。
反映確認は Cloudflare の管理画面より `curl` で本番ファイルを直接見るほうが速くて確実です
（`.html` は拡張子なし URL へ 308 リダイレクトするため `-L` が必要）。

バックエンド（`/api/*`）は `functions/api/` の Cloudflare Pages Functions です。
API キー等の環境変数は **同僚の Cloudflare Pages → Settings → Environment variables** に設定されており、
変更後は再デプロイしないと反映されません。

> ⚠️ **Netlify は使っていません（2026-06 に移行済み）。**
> 2026-05〜06 の初期はホスティング・バックエンド・ログイン（Netlify Identity）すべてが Netlify 上にありましたが、
> ログインは Firebase Auth（2026-06-04）へ、ホスティングとバックエンドは Cloudflare Pages へ移行しました。
> `netlify.toml` と `netlify/` は 2026-07-01 に削除済みです。
> なお **移行後も Netlify 側のプロジェクトだけが残って自動ビルドを続けており**、
> 2026-08-19 に削除しました（経緯は `docs/tools/00-architecture.md` を参照）。

---

## カスタマイズの注意事項

- **フォント**: Google Fonts の Noto Serif JP / Noto Sans JP / Inter を使用
- **多言語**: `js/main.js` の翻訳データ（`T` オブジェクト）を編集
- **デザイン変数**: `css/main.css` の `:root {}` ブロックで色・フォントを変更可能
- **デモページ**: `solutions/demo.html` のプレースホルダーを実際の AI 機能に差し替え
