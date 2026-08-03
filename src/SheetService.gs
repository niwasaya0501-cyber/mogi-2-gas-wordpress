/**
 * 「記事リスト」シートの読み書きを担当する。
 * 列構成: A キーワード / B サブキーワード / C ステータス / D タイトル
 *         / E メタディスクリプション / F 本文（HTML） / G 更新日時 / H 備考（エラー内容）
 *
 * A・B列はクライアント提供のキーワードCSV（data/keywords-sample.csv）の構成に合わせている。
 */
const SHEET_NAME = '記事リスト';

const COLUMNS = {
  KEYWORD: 1,
  SUB_KEYWORD: 2,
  STATUS: 3,
  TITLE: 4,
  META_DESCRIPTION: 5,
  BODY: 6,
  UPDATED_AT: 7,
  NOTE: 8
};

const STATUS = {
  PENDING: '未生成',
  PROCESSING: '生成中',
  DONE: '生成完了',
  ERROR: 'エラー'
};

function getSheet_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error(`シート「${SHEET_NAME}」が見つかりません。README の手順に沿ってシートを用意してください。`);
  }
  return sheet;
}

/** キーワードが入力済みで、未処理（空欄 or 「未生成」）の行を取得する */
function getPendingRows_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, Object.keys(COLUMNS).length).getValues();
  const rows = [];

  values.forEach((row, index) => {
    const keyword = row[COLUMNS.KEYWORD - 1];
    const subKeyword = row[COLUMNS.SUB_KEYWORD - 1];
    const status = row[COLUMNS.STATUS - 1];
    if (keyword && (!status || status === STATUS.PENDING)) {
      rows.push({
        rowNumber: index + 2,
        keyword: String(keyword).trim(),
        subKeyword: subKeyword ? String(subKeyword).trim() : ''
      });
    }
  });

  return rows;
}

function updateRow_(rowNumber, values) {
  const sheet = getSheet_();

  if (values.status !== undefined) {
    sheet.getRange(rowNumber, COLUMNS.STATUS).setValue(values.status);
  }
  if (values.title !== undefined) {
    sheet.getRange(rowNumber, COLUMNS.TITLE).setValue(values.title);
  }
  if (values.metaDescription !== undefined) {
    sheet.getRange(rowNumber, COLUMNS.META_DESCRIPTION).setValue(values.metaDescription);
  }
  if (values.body !== undefined) {
    sheet.getRange(rowNumber, COLUMNS.BODY).setValue(values.body);
  }
  if (values.note !== undefined) {
    sheet.getRange(rowNumber, COLUMNS.NOTE).setValue(values.note);
  }

  sheet.getRange(rowNumber, COLUMNS.UPDATED_AT).setValue(new Date());
}
