/**
 * スクリプトプロパティ（設定 > スクリプトプロパティ）から接続情報を読み込む。
 *
 * 今回のスコープではWordPressへの実投稿を行わないため、WP_* は必須にしていない。
 * 実投稿を有効化する場合は WordPressClient.gs の createWordPressDraft_ を使うよう
 * Code.gs を変更し、下の requiredKeys に wpBaseUrl / wpUsername / wpAppPassword を追加する。
 *
 * referenceArticleText が未設定の場合は、ReferenceArticle.gs の
 * DEFAULT_REFERENCE_ARTICLE_TEXT（キンタイCloudのサンプル記事）を既定値として使う。
 */
function getConfig_() {
  const props = PropertiesService.getScriptProperties();
  const config = {
    openaiApiKey: props.getProperty('OPENAI_API_KEY'),
    referenceArticleText: props.getProperty('REFERENCE_ARTICLE_TEXT') || DEFAULT_REFERENCE_ARTICLE_TEXT,
    wpBaseUrl: props.getProperty('WP_BASE_URL') || '',
    wpUsername: props.getProperty('WP_USERNAME') || '',
    wpAppPassword: props.getProperty('WP_APP_PASSWORD') || ''
  };

  const requiredKeys = ['openaiApiKey'];
  const missing = requiredKeys.filter((key) => !config[key]);

  if (missing.length > 0) {
    throw new Error(
      `スクリプトプロパティが未設定です: ${missing.join(', ')}\n` +
      '「プロジェクトの設定 > スクリプトプロパティ」から設定してください。'
    );
  }

  return config;
}
