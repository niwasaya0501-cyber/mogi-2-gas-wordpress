/**
 * UrlFetchApp の共通ラッパー。
 * 「リクエスト実行 → ステータスコード確認 → JSON解析 → エラーメッセージ組み立て」
 * という、OpenAI/WordPress両方のAPIクライアントで重複していた処理を1箇所にまとめる。
 */
function fetchJson_(url, options, expectedStatus, errorLabel) {
  const response = UrlFetchApp.fetch(url, Object.assign({ muteHttpExceptions: true }, options));
  const statusCode = response.getResponseCode();
  const rawText = response.getContentText();

  let body = null;
  try {
    body = JSON.parse(rawText);
  } catch (e) {
    body = null;
  }

  if (statusCode !== expectedStatus) {
    const message = body && (body.error ? body.error.message : body.message);
    throw new Error(`${errorLabel} (${statusCode}): ${message || rawText}`);
  }

  if (!body) {
    throw new Error(`${errorLabel} (${statusCode}): レスポンスをJSONとして解析できませんでした。`);
  }

  return body;
}
