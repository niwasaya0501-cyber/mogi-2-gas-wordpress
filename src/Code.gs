/**
 * スプレッドシートのメニューから起動するエントリーポイント。
 */
const MANUAL_URLS_ = {
  apiKeySetup: 'https://claude.ai/code/artifact/99df6620-c6c8-4dc8-a4dc-45e612d22248',
  usage: 'https://claude.ai/code/artifact/601a243d-ecb1-43ef-9ced-3880ba590adb',
  troubleshooting: 'https://claude.ai/code/artifact/fa540d64-259e-42f9-a0ed-17c61f9b4582'
};

function onOpen() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu('記事自動生成')
    .addItem('未処理のキーワードを一括生成', 'generatePendingArticles')
    .addToUi();

  ui.createMenu('マニュアル')
    .addItem('① APIキー設定手順書', 'openApiKeySetupManual_')
    .addItem('② 使い方マニュアル', 'openUsageManual_')
    .addItem('③ トラブルシューティング', 'openTroubleshootingManual_')
    .addToUi();
}

function openApiKeySetupManual_() {
  openManualUrl_(MANUAL_URLS_.apiKeySetup);
}

function openUsageManual_() {
  openManualUrl_(MANUAL_URLS_.usage);
}

function openTroubleshootingManual_() {
  openManualUrl_(MANUAL_URLS_.troubleshooting);
}

/** メニューのクリックから直接ブラウザタブを開けないため、開いたら即閉じる透明なダイアログ経由でリンクを開く */
function openManualUrl_(url) {
  const html = HtmlService
    .createHtmlOutput(`<script>window.open('${url}', '_blank');google.script.host.close();</script>`)
    .setWidth(1)
    .setHeight(1);
  SpreadsheetApp.getUi().showModalDialog(html, 'マニュアルを開いています…');
}

function generatePendingArticles() {
  const ui = SpreadsheetApp.getUi();
  const config = getConfig_();
  const rows = getPendingRows_();

  if (rows.length === 0) {
    ui.alert('未処理のキーワードがありません。「記事リスト」シートのA列にキーワードを追加してください。');
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  rows.forEach((row) => {
    try {
      updateRow_(row.rowNumber, { status: STATUS.PROCESSING });

      const article = generateArticleDraft_(row.keyword, row.subKeyword, config);

      // WordPressへは投稿せず、送信予定のペイロードをログ出力して確認するのみ
      const payload = buildWordPressDraftPayload_(article);
      logWordPressPayload_(row.keyword, payload);

      updateRow_(row.rowNumber, {
        status: STATUS.DONE,
        title: article.title,
        metaDescription: article.meta_description,
        body: article.body_html,
        note: ''
      });
      successCount += 1;
    } catch (error) {
      updateRow_(row.rowNumber, {
        status: STATUS.ERROR,
        note: error.message
      });
      errorCount += 1;
    }
  });

  ui.alert(
    `処理が完了しました。\n成功: ${successCount}件 / エラー: ${errorCount}件\n\n` +
    'WordPressへの実投稿は行っていません。送信予定のペイロードは実行ログで確認できます。\n' +
    '生成された本文は必ず公開前に内容を確認してください。'
  );
}
