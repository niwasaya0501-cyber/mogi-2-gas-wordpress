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

// config内の各キーに対応する、実際のスクリプトプロパティ名
const PROPERTY_NAMES_ = {
  openaiApiKey: 'OPENAI_API_KEY',
  referenceArticleText: 'REFERENCE_ARTICLE_TEXT',
  wpBaseUrl: 'WP_BASE_URL',
  wpUsername: 'WP_USERNAME',
  wpAppPassword: 'WP_APP_PASSWORD'
};

function getConfig_() {
  const props = PropertiesService.getScriptProperties();
  const config = {};

  Object.keys(PROPERTY_NAMES_).forEach((key) => {
    config[key] = props.getProperty(PROPERTY_NAMES_[key]) || '';
  });
  config.referenceArticleText = config.referenceArticleText || DEFAULT_REFERENCE_ARTICLE_TEXT;

  const requiredKeys = ['openaiApiKey'];
  const missing = requiredKeys.filter((key) => !config[key]).map((key) => PROPERTY_NAMES_[key]);

  if (missing.length > 0) {
    throw new Error(
      `スクリプトプロパティが未設定です: ${missing.join(', ')}\n` +
      '「プロジェクトの設定 > スクリプトプロパティ」から、上記の名前どおりに（大文字・アンダースコア込みで）設定してください。'
    );
  }

  return config;
}
