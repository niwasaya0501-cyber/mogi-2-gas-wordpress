/**
 * スプレッドシートのメニューから起動するエントリーポイント。
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('記事自動生成')
    .addItem('未処理のキーワードを一括生成', 'generatePendingArticles')
    .addToUi();
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
