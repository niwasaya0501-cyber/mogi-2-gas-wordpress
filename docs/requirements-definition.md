# 要件定義書 — ブログ記事自動生成システム（GAS + OpenAI API + WordPress連携）

| 項目 | 内容 |
|---|---|
| 文書種別 | 要件定義書 |
| 対象案件 | 模擬案件2（ポートフォリオ用） |
| 作成日 | 2026-08-05 |
| バージョン | 1.0 |
| 関連文書 | [提案書](../requirements.md) / [README（セットアップ手順）](../README.md) / [納品物一覧](./deliverables.md) |

> 本書は、[requirements.md](../requirements.md)（クライアントへの提案書）で合意した内容を、実装可能な粒度まで落とし込んだ要件定義書です。クライアントは架空のクラウド勤怠管理サービス「キンタイCloud」を想定しています。

---

## 1. 背景・目的

- クライアントはブログを週3本更新する運用ノルマがあり、1本あたり構成〜執筆に約3時間かかっている（週9時間）。
- ネタ出し〜構成〜執筆を毎回ゼロから行っており、担当者の負荷が高い。
- スプレッドシートにキーワードを入力するだけでAIが記事下書き（タイトル・メタディスクリプション・本文）を生成し、人が10分程度の編集で仕上げられる状態を目指す。
- 執筆時間を1本3時間 → 30分以下に短縮することが目的（KPI）。

## 2. システム全体構成

```mermaid
flowchart LR
    A["Google スプレッドシート\n（記事リストシート）"] -->|"メニュー実行\n(記事自動生成)"| B["Google Apps Script\n(GAS / V8ランタイム)"]
    B -->|"1. 記事生成リクエスト\n(Chat Completions API)"| C["OpenAI API\ngpt-4o-mini"]
    C -->|"title / meta_description / body_html\n(JSON)"| B
    B -->|"2. 生成結果を書き込み"| A
    B -.->|"3. 投稿ペイロード組み立て\n(今回は送信せず Logger.log 出力のみ)"| D["WordPress REST API\nwp-json/wp/v2/posts"]
```

- **フロントエンド／操作画面**: Google スプレッドシート（メニューから実行するだけのUI。専用画面は作らない）
- **実行環境**: Google Apps Script（コンテナバインドスクリプト、`rootDir: src`、`timeZone: Asia/Tokyo`、`runtimeVersion: V8`）
- **AI生成**: OpenAI API（`gpt-4o-mini`, Chat Completions, `response_format: json_object`）
- **投稿先**: WordPress（REST API連携仕様は「3. WordPress連携仕様」に定義。**今回のスコープでは実際の書き込みは行わない**）

## 3. WordPress連携仕様（本システムが定義した構成）

クライアントの要望は「生成した記事をWordPressに下書き保存する」ことだが、今回のスコープでは**投稿ロジックまでを実装し、実際の送信は行わない**（詳細は 4.3 スコープ外を参照）。以下は、実装済みのWordPress連携が前提とする構成である。

### 3.1 想定するWordPress環境
- クライアント独自ドメイン上で、**有料レンタルサーバー等にインストールした一般的なWordPress**（wordpress.org版ソフトウェア）を運用している想定（例: `https://example-saas.co.jp/blog/` のようにブログを独自ドメイン配下のディレクトリで運用）。
  - サーバーの自己管理（VPS等でのセルフホスト運用）を必須とはしない。エックスサーバー等の一般的な有料レンタルサーバーで動く、標準的なwordpress.org版であれば対象。
  - **WordPress.com（wordpress.comの有料プラン）は対象外**。WordPress.com独自のREST API（OAuth2認証中心）とは認証方式・エンドポイントが異なるため、本仕様（3.2）はそのままでは使えない。
- REST APIがデフォルトのまま有効になっていること（wordpress.org版であれば標準搭載、プラグイン等の追加設定は不要）。
- パーマリンク設定が「基本」（`?p=123`形式）以外になっていること（REST APIのルート `/wp-json/` が正しく解決されるための一般的な前提条件）。
- 投稿権限を持つユーザーアカウントが1つ用意されていること（下書き作成のみなので `投稿者` 権限以上で可）。

### 3.2 API仕様
| 項目 | 内容 |
|---|---|
| エンドポイント | `POST {WP_BASE_URL}/wp-json/wp/v2/posts`（WordPress REST API v2, 標準の投稿エンドポイント） |
| `WP_BASE_URL` の例 | `https://example-saas.co.jp/blog`（ブログが独自ドメイン配下のサブディレクトリで運用されている場合、そのディレクトリまでを含めて設定する） |
| 認証方式 | **Basic認証 + アプリケーションパスワード**（WordPress 5.6以降の標準機能。プラグイン不要） |
| Authorizationヘッダー | `Basic base64(ユーザー名:アプリケーションパスワード)` |
| Content-Type | `application/json` |
| 期待するレスポンス | `201 Created`（失敗時はエラーメッセージを例外として送出） |

送信ペイロード（`buildWordPressDraftPayload_`, [`src/WordPressClient.gs`](../src/WordPressClient.gs)）:

```json
{
  "title": "AI生成タイトル",
  "content": "AI生成本文（HTML断片）",
  "excerpt": "AI生成メタディスクリプション",
  "status": "draft"
}
```

- `status` は常に `"draft"` に固定し、**自動公開は行わない**設計とする（提案書「やらないこと」に対応）。
- `content` にはAIが生成した `<h2>` / `<p>` のHTML断片をそのまま渡す（タイトルタグや本文以外の装飾は含めない）。
- 認証情報（`WP_BASE_URL` / `WP_USERNAME` / `WP_APP_PASSWORD`）はソースコードに直書きせず、GASの**スクリプトプロパティ**で管理する（[`src/Config.gs`](../src/Config.gs)）。

### 3.3 今回のスコープでの扱い
- `createWordPressDraft_`（実際に投稿するコード）は実装・レビュー済みだが、[`src/Code.gs`](../src/Code.gs) の `generatePendingArticles()` からは**呼び出していない**。
- 代わりに `logWordPressPayload_` が送信予定のペイロードを実行ログに出力するのみ（実際のHTTPリクエストは発生しない）。
- `Config.gs` の `requiredKeys` には `wpBaseUrl` / `wpUsername` / `wpAppPassword` を含めていない（未設定でもエラーにならない）＝実運用開始前の安全弁。

### 3.4 実投稿を有効化する場合の変更点（将来対応）
1. WordPress管理画面 > ユーザー > プロフィール から「アプリケーションパスワード」を発行する。
2. GASのスクリプトプロパティに `WP_BASE_URL` / `WP_USERNAME` / `WP_APP_PASSWORD` を設定する。
3. [`src/Config.gs`](../src/Config.gs) の `requiredKeys` に上記3項目を追加する。
4. [`src/Code.gs`](../src/Code.gs) の `generatePendingArticles()` 内で `logWordPressPayload_` の代わりに `createWordPressDraft_(payload, config)` を呼び出すよう変更する。

## 4. 機能要件

### 4.1 実装した機能（Doing）
| # | 機能 | 内容 | 実装ファイル |
|---|---|---|---|
| 1 | キーワード入力 | スプレッドシートA・B列にキーワード／サブキーワードを入力 | — |
| 2 | メニュー実行 | 「記事自動生成 > 未処理のキーワードを一括生成」で起動 | `Code.gs` |
| 3 | 記事下書き生成 | OpenAI APIでタイトル・メタディスクリプション・本文（HTML）を生成 | `ArticleGenerator.gs` |
| 4 | トーン再現 | 参考記事（`ReferenceArticle.gs` に埋め込み、スクリプトプロパティで上書き可）のトーンをシステムプロンプトで指示 | `ArticleGenerator.gs` |
| 5 | 文字数保証 | 本文2,000文字未満の場合、1回だけ増量リクエストを自動送信 | `ArticleGenerator.gs` |
| 6 | シート書き込み | 生成結果（タイトル／メタディスクリプション／本文／更新日時）をシートに書き込み、本文はセル内で読みやすく整形 | `SheetService.gs` |
| 7 | ステータス管理 | 未生成 → 生成中 → 生成完了／エラー の4状態を管理 | `SheetService.gs` |
| 8 | WordPress送信ペイロード組み立て | 3.2節の仕様でペイロードを組み立て、ログ出力 | `WordPressClient.gs` |
| 9 | エラーハンドリング | 行単位でtry/catchし、1行のエラーが他行の処理を止めない。エラー内容をH列（備考）に記録 | `Code.gs` |
| 10 | マニュアル導線 | スプレッドシートメニューから①APIキー設定手順書②使い方マニュアル③トラブルシューティングを開ける | `Code.gs` |

### 4.2 データ設計（記事リストシート）
| 列 | 項目 | 入力元 |
|---|---|---|
| A | キーワード | クライアント入力（必須） |
| B | サブキーワード | クライアント入力（任意） |
| C | ステータス | システム自動更新（未生成／生成中／生成完了／エラー） |
| D | タイトル | AI生成 |
| E | メタディスクリプション | AI生成 |
| F | 本文（HTML） | AI生成 |
| G | 更新日時 | システム自動更新 |
| H | 備考（エラー内容） | システム自動更新 |

### 4.3 スコープ外（やらないこと）
- WordPressへの実投稿（3.3節のとおり、コードは実装済みだが未接続）
- 記事の自動公開（`status` は常に `draft`。公開判断は人間が行う）
- 画像の自動挿入（担当者が手動設定）
- 外部コピペチェックツールとの自動連携（プロンプトでオリジナリティを指示 ＋ 公開前の手動チェックを運用でカバー）

## 5. 非機能要件

| 分類 | 内容 |
|---|---|
| 認証・秘匿情報 | APIキー・WordPress認証情報はGASスクリプトプロパティで管理し、ソースコード・リポジトリには含めない |
| 実行時間制約 | GAS個人アカウントは1回の実行につき最大6分。未処理件数が多いと途中終了する可能性があり、その場合は該当行が「生成中」で停止する（手動でステータスを空欄に戻して再実行） |
| プロンプトインジェクション対策 | ユーザー入力（キーワード）は `<user_keyword>` タグで囲み、システムプロンプトで「指示ではなくデータとして扱う」ことを明示 |
| コスト | OpenAI APIは従量課金（月額500〜1,000円想定）。文字数不足時の増量リクエストで従量課金が追加発生する行がある |
| ロギング | WordPress送信ペイロード・エラー内容はGASの実行ログ（Logger.log）で確認可能 |
| テスト容易性 | GAS環境やAPIキーなしでロジック検証できるNode.jsモックハーネスを用意（`test/local-harness.js`） |

## 6. 開発・検証方針

- ローカル検証: `node test/local-harness.js` で以下を確認
  - 正常系（生成〜書き込み〜ステータス更新）
  - プロンプトインジェクション疑似ケースでの異常終了なし
  - OpenAI APIエラー時のエラー行処理・他行への非影響
  - 文字数不足時の増量リクエストと最終文字数
  - WordPress送信ペイロードの形（`{ title, content, excerpt, status: 'draft' }`）
- 本番反映: `clasp push`、またはApps Scriptエディタへの手動コピペ

## 7. 納品物

[docs/deliverables.md](./deliverables.md) を参照（APIキー設定手順書／使い方マニュアル／トラブルシューティングの3点、いずれもClaude Artifactのリンク）。

## 8. スケジュール・費用（提案書より）

- 開発期間: 1週間
- 初期費用: 4.5万円（税込）
- 月額: OpenAI API費用 約500〜1,000円
