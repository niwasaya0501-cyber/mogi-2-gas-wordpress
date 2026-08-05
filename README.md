# ブログ記事自動生成システム（GAS + OpenAI API + WordPress連携コード）

スプレッドシートにキーワードを入力するだけで、OpenAI（ChatGPT）がブログ記事の下書き（タイトル・メタディスクリプション・本文）を生成し、スプレッドシートに書き出す仕組みです。

> 本リポジトリは模擬案件（ポートフォリオ用・案件2）として作成しています。提案背景は [`requirements.md`](./requirements.md)（提案書）、実装レベルの詳細は [`docs/requirements-definition.md`](./docs/requirements-definition.md)（要件定義書・WordPress連携仕様を含む）を参照してください。
> 提案書（デザイン版・Artifact）: https://claude.ai/code/artifact/9d32d878-8a14-4913-8e69-59c593356835

案件2では、架空のクラウド勤怠管理サービス「キンタイ Cloud」を題材に、トーン見本記事とSEOキーワードリストを [`data/`](./data) 配下に格納しています。

- [`data/reference-article.md`](./data/reference-article.md) — トーン&マナーの見本記事（「キンタイ Cloud」公式ブログ想定）
- [`data/keywords-sample.csv`](./data/keywords-sample.csv) — SEOキーワード・サブキーワードのサンプルリスト

見本記事の内容は `src/ReferenceArticle.gs` の `DEFAULT_REFERENCE_ARTICLE_TEXT` にそのまま埋め込んであり、スクリプトプロパティ `REFERENCE_ARTICLE_TEXT` を設定しなくても、この案件のトーンで下書きが生成されます（別のトーンで使う場合はスクリプトプロパティで上書きしてください）。

## 今回のスコープ

**できること**
- スプレッドシートのA・B列にキーワード／サブキーワードを入力 → メニューから実行するだけで下書き生成
- 構成は「タイトル → 導入 → H2見出し3つ → まとめ」、文字数2,000〜3,000文字で統一（本文が2,000文字未満の場合は自動で1回だけ増量リクエストを行い、目標文字数を保証する）
- 参考記事のトーン（カジュアルだが専門的）をプロンプトで再現
- サブキーワードも本文に自然に含めるようプロンプトで指示（SEOカバレッジ向上）
- SEO用のメタディスクリプションも同時生成
- 生成した **タイトル・メタディスクリプション・本文（HTML）をスプレッドシートに書き出す**
- WordPress REST API に送信する想定のペイロード（`title` / `content` / `status: 'draft'` / `excerpt`）を組み立て、実行ログに出力して内容を確認できる
- 処理状況をシート上で管理（未生成 / 生成中 / 生成完了 / エラー）
- スプレッドシートのメニューに「マニュアル」を追加し、①APIキー設定手順書 ②使い方マニュアル ③トラブルシューティングをワンクリックで開ける（[`docs/deliverables.md`](./docs/deliverables.md) 参照）

**今回やらないこと（意図的に対象外）**
- **WordPressへの実投稿。** `WordPressClient.gs` に投稿用のコードは実装済みですが、今回は呼び出さず、送信予定のペイロードを `Logger.log` に出力するところまでとしています（実際にWordPressサイトへ書き込みは行いません）
- 記事の自動公開
- 画像の自動挿入（担当者が手動で設定）
- 外部コピペチェックツールとの自動連携。代わりに以下の対策をしています
  - プロンプトで「既存記事のコピー・言い換え禁止、独自の視点で書くこと」を明示的に指示
  - 公開前に [CopyContentDetector](https://ccd.cloud/) 等での手動チェックを推奨

実際にWordPressへ投稿する場合は、`WordPressClient.gs` の `createWordPressDraft_` を `Code.gs` から呼び出すよう変更し、`Config.gs` で `WP_BASE_URL` / `WP_USERNAME` / `WP_APP_PASSWORD` を必須項目に戻してください（関数自体はレビュー済みで実装済みです）。

## 構成

```
data/
  reference-article.md # トーン見本記事（「キンタイ Cloud」想定・案件2サンプル素材）
  keywords-sample.csv  # SEOキーワード・サブキーワードのサンプルリスト
src/
  Code.gs              # メニュー登録・全体の処理フロー
  Config.gs            # スクリプトプロパティ（APIキー等）の読み込み
  ReferenceArticle.gs  # 参考記事のデフォルト値（data/reference-article.md を埋め込み）
  SheetService.gs      # スプレッドシートの読み書き
  ArticleGenerator.gs  # OpenAI API 呼び出し・プロンプト構築
  WordPressClient.gs   # WordPress送信ペイロードの組み立て・ログ出力（実投稿コードは未使用のまま実装）
  appsscript.json      # GASプロジェクトのマニフェスト
test/
  local-harness.js     # GAS環境なしでロジックを検証するモックハーネス
```

## セットアップ手順

### 1. スプレッドシートを用意する

新しい Google スプレッドシートを作成し、シート名を `記事リスト` にして、1行目に以下のヘッダーを入力します。

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| キーワード | サブキーワード | ステータス | タイトル | メタディスクリプション | 本文（HTML） | 更新日時 | 備考 |

2行目以降に、[`data/keywords-sample.csv`](./data/keywords-sample.csv) のキーワード・サブキーワード列をコピー＆ペーストしてください（同ファイルの「タイトル」「WordPress URL」列は本システムでは使わないため無視して問題ありません）。ステータス列は空欄のままでOKです（未入力時は自動的に「未生成」として扱われます）。

### 2. OpenAI APIキーを取得する

[OpenAI Platform](https://platform.openai.com/api-keys) でAPIキーを発行します。

### 3. Apps Script プロジェクトを作成し、コードを反映する

[clasp](https://github.com/google/clasp) を使う場合:

```bash
npm install -g @google/clasp
clasp login

# スプレッドシートに紐づくGASプロジェクトを新規作成する場合
clasp create --type sheets --title "ブログ記事自動生成" --rootDir src

# 既存のスクリプトIDがある場合は .clasp.json.example を .clasp.json にコピーして scriptId を設定
cp .clasp.json.example .clasp.json

clasp push
```

clasp を使わない場合は、対象スプレッドシートの「拡張機能 > Apps Script」を開き、`src/` 内の各ファイルの中身をコピー＆ペーストして同名のファイルを作成してください。

### 4. スクリプトプロパティを設定する

Apps Script エディタで「プロジェクトの設定 > スクリプトプロパティ」から以下を追加します。

| プロパティ名 | 内容 | 必須 |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI の APIキー | ✅ |
| `REFERENCE_ARTICLE_TEXT` | トーンを合わせたい参考記事の本文テキスト | 任意 |
| `WP_BASE_URL` | WordPressサイトのURL（実投稿を有効化する場合のみ使用） | 任意（今回未使用） |
| `WP_USERNAME` | WordPressのユーザー名（同上） | 任意（今回未使用） |
| `WP_APP_PASSWORD` | WordPressのアプリケーションパスワード（同上） | 任意（今回未使用） |

### 5. 実行する

対象のスプレッドシートを開き直すと、メニューバーに「記事自動生成」と「マニュアル」が追加されます。

`記事自動生成 > 未処理のキーワードを一括生成` を実行すると、A列にキーワードがありステータスが空欄／「未生成」の行がすべて処理されます。

「マニュアル」メニューからは、①APIキー設定手順書 ②使い方マニュアル ③トラブルシューティングを直接開けます（初回クリック時は `showModalDialog` 用の追加権限承認が求められるので、画面の案内に沿って許可してください）。

初回実行時はGoogleアカウントの権限承認（スプレッドシートへのアクセス、外部リクエストの許可）が求められるので、承認してください。

### 6. 送信予定のWordPressペイロードを確認する

Apps Script エディタで「実行数」（または実行後に表示される「ログ」）を開くと、`logWordPressPayload_` が出力した以下の内容を確認できます。

```
--- WordPress送信ペイロード（未送信・確認用） ---
キーワード: ○○○○
{
  "title": "...",
  "content": "...",
  "excerpt": "...",
  "status": "draft"
}
```

## ローカルでの動作確認（GAS環境なし）

Google Apps Script環境やclaspログインなしで、`src/*.gs` のロジックだけを手元で検証できるハーネスを用意しています。`SpreadsheetApp` / `PropertiesService` / `UrlFetchApp` などのGAS APIをNode.js上でモックし、OpenAI APIへの通信部分だけ偽のレスポンスに差し替えて `generatePendingArticles()` を実際に実行します。

```bash
node test/local-harness.js
```

検証している内容:
- 正常系: キーワードから記事が生成され、シートのステータスが「生成完了」になり、タイトル・メタディスクリプション・本文が書き込まれること
- サブキーワード欄に指示文めいた文字列（プロンプトインジェクションの疑似ケース）が入っていても、処理が異常終了せず単なるデータとして扱われること
- 異常系: OpenAI APIがエラーを返した場合にステータスが「エラー」になり、備考にエラー内容が記録され、他の行の処理には影響しないこと
- 文字数不足ケース: 本文が2,000文字未満の場合に増量リクエストが1回だけ行われ、最終的に2,000文字以上・元のタイトルのまま「生成完了」になること
- WordPress送信ペイロードのログが `{ title, content, excerpt, status: 'draft' }` の形になっていること

**限界**: このハーネスはOpenAI APIへの通信を偽のレスポンスに差し替えているため、`<user_keyword>` タグ内の指示文めいた入力を実際のモデルが本当に無視するかどうかまでは検証できません。それを確認するには、実際のOpenAI APIキーを使って呼び出す必要があります。

## 運用上の注意

- 今回の範囲では **WordPressへの書き込みは一切発生しません**（ペイロードの組み立て・ログ出力のみ）。
- 生成された本文・メタディスクリプションはスプレッドシートのE・F列に書き出されます。**公開判断の前に必ず内容の事実確認・オリジナリティの目視チェックを行ってください。**
- OpenAI APIの利用料は従量課金です。生成本数に応じて費用が発生します。本文が2,000文字に届かない場合は自動で増量リクエストが1回追加で発生するため、該当行は費用・処理時間がその分増えます。
- エラーが発生した行はステータスが「エラー」になり、H列（備考）にエラー内容が記録されます。内容を確認し、必要であればステータスを空欄に戻して再実行してください。
- GASは1回の実行につき最大6分の実行時間制限があります（個人のGoogleアカウントの場合）。未処理のキーワードが多いと途中で強制終了することがあり、その場合は該当行のステータスが「生成中」のまま止まります（自動では再処理されないため、C列を手動で空欄に戻してから再実行してください）。詳しくは③トラブルシューティングを参照してください。
