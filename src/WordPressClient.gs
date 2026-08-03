/**
 * WordPress REST API 連携。
 *
 * 今回のスコープでは実際の投稿は行わない。送信予定のペイロード（title / content /
 * status: 'draft' / excerpt）を組み立て、Logger.log で内容を確認できるところまでとする。
 * 実際に投稿する場合は、下部の createWordPressDraft_ を Code.gs から呼び出すよう変更し、
 * Config.gs で WP_BASE_URL / WP_USERNAME / WP_APP_PASSWORD を必須項目に戻す。
 */

/** WordPress REST API (`POST /wp-json/wp/v2/posts`) に送信する想定のペイロードを組み立てる */
function buildWordPressDraftPayload_(article) {
  return {
    title: article.title,
    content: article.body_html,
    excerpt: article.meta_description,
    status: 'draft'
  };
}

/** 送信予定のペイロードを実行ログに出力する（実際には送信しない） */
function logWordPressPayload_(keyword, payload) {
  Logger.log('--- WordPress送信ペイロード（未送信・確認用） ---');
  Logger.log(`キーワード: ${keyword}`);
  Logger.log(JSON.stringify(payload, null, 2));
}

/**
 * 実際にWordPressへ下書き投稿する（今回は未使用）。
 * 有効化するには Config.gs で WP_BASE_URL / WP_USERNAME / WP_APP_PASSWORD を必須にし、
 * Code.gs から本関数を呼び出すよう変更する。
 */
function createWordPressDraft_(payload, config) {
  const baseUrl = config.wpBaseUrl.replace(/\/$/, '');
  const credentials = Utilities.base64Encode(`${config.wpUsername}:${config.wpAppPassword}`);

  const body = fetchJson_(
    `${baseUrl}/wp-json/wp/v2/posts`,
    {
      method: 'post',
      headers: {
        Authorization: `Basic ${credentials}`,
        'content-type': 'application/json'
      },
      payload: JSON.stringify(payload)
    },
    201,
    'WordPress投稿エラー'
  );

  return { postId: body.id, editUrl: `${baseUrl}/wp-admin/post.php?post=${body.id}&action=edit` };
}
