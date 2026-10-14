import { InjectionToken } from '@angular/core';

/**
 * 富文字編輯器、顯示與留言串的畫面文字。libs/ui 不內建使用者可見字串，由使用端在 `providers` 提供一次。
 * 帶參數的句子用 `{name}` 佔位：`{label}` 按鈕名稱、`{keys}` 快捷鍵、`{count}` 數量、`{query}` 提及的查詢字、
 * `{name}` 人名、`{time}` 完整時間。相對時間（「3 分鐘前」）由 `Intl.RelativeTimeFormat` 依 I18nService 的語言產生，不放在這裡。
 */
export interface RichTextLabels {
  // ---- 編輯器 ----
  /** 編輯區的預設無障礙名稱（沒給 `ariaLabel` 時），例：「內容」。 */
  editor: string;
  /** 編輯器程式還在載入時（第一次打開，通常不到一秒）給報讀器念的字，例：「編輯器載入中」。 */
  loading: string;
  /** 工具列的無障礙名稱，例：「文字格式」。 */
  toolbar: string;
  /** 例：「粗體」。 */
  bold: string;
  /** 例：「斜體」。 */
  emphasis: string;
  /** 例：「項目清單」。 */
  bulletList: string;
  /** 例：「編號清單」。 */
  orderedList: string;
  /** 例：「引用」。 */
  blockquote: string;
  /** 例：「連結」。 */
  link: string;
  /** 例：「清除格式」。 */
  clearFormat: string;
  /** 工具列按鈕的提示（tooltip），例：「{label}（{keys}）」；沒有快捷鍵的按鈕只顯示名稱。 */
  toolTip: string;
  /** 連結小視窗的標題（新增），例：「插入連結」。 */
  linkInsertTitle: string;
  /** 連結小視窗的標題（游標在既有連結上），例：「編輯連結」。 */
  linkEditTitle: string;
  /** 網址欄位的標籤，例：「網址」。 */
  linkUrl: string;
  /** 網址欄位下方的提示，例：「http://、https:// 或 mailto: 開頭」。 */
  linkHint: string;
  /** 協定不在白名單、或不是網址，例：「只接受 http、https 或 mailto 連結」。 */
  linkInvalid: string;
  /** 例：「套用」。 */
  linkApply: string;
  /** 例：「移除連結」。 */
  linkRemove: string;
  /** 例：「取消」。 */
  cancel: string;
  /** 提及建議清單的無障礙名稱，例：「提及成員」。 */
  mentionList: string;
  /** 例：「搜尋中…」。 */
  mentionLoading: string;
  /** 例：「找不到「{query}」」。 */
  mentionEmpty: string;
  /** 例：「搜尋失敗，請再輸入一次」。 */
  mentionError: string;
  /** 字數接近上限時，例：「剩 {count} 字」。 */
  remaining: string;
  /** 超過上限（錯誤訊息），例：「超過 {count} 字，請刪減」。 */
  overLimit: string;

  // ---- 留言串 ----
  /** 留言清單的無障礙名稱，例：「留言」。 */
  thread: string;
  /** 新留言輸入框的無障礙名稱，例：「新增留言」。 */
  composer: string;
  /** 新留言輸入框的 placeholder，例：「寫下留言，輸入 @ 提及同事」。 */
  composerPlaceholder: string;
  /** 送出鈕，例：「送出」。 */
  send: string;
  /** 送出中，例：「送出中…」。 */
  sending: string;
  /** 送出鈕旁的快捷鍵提示，例：「{keys} 送出」。 */
  sendHint: string;
  /** 送出失敗（內容保留），例：「送出失敗，內容還在，可以再試一次」。 */
  sendFailed: string;
  /** 例：「重試」。 */
  retry: string;
  /** 例：「編輯」。 */
  edit: string;
  /** 例：「儲存」。 */
  save: string;
  /** 例：「刪除」。 */
  delete: string;
  /** 自己的留言的動作選單的無障礙名稱，例：「{name} 的留言動作」。 */
  actions: string;
  /** 編輯失敗（內容保留），例：「儲存失敗，請再試一次」。 */
  editFailed: string;
  /** 刪除失敗，例：「刪除失敗，請再試一次」。 */
  deleteFailed: string;
  /** 確認對話框的標題，例：「刪除留言？」。 */
  deleteTitle: string;
  /** 確認對話框的說明，例：「刪除後無法復原。」。 */
  deleteMessage: string;
  /** 已編輯的標記，例：「已編輯」。 */
  edited: string;
  /** 已編輯標記的提示（完整的編輯時間），例：「編輯於 {time}」。 */
  editedAt: string;
  /** 自己的留言名字旁的小字，例：「（你）」。 */
  you: string;
  /** 摺疊的較早留言，例：「顯示較早的 {count} 則」。 */
  showEarlier: string;
  /** 沒有留言，例：「還沒有留言」。 */
  empty: string;
  /** 沒有留言時的說明，例：「有問題或進度更新，留言給同事；輸入 @ 可以提及他。」。 */
  emptyDetail: string;
}

export const RICH_TEXT_LABELS = new InjectionToken<RichTextLabels>('RICH_TEXT_LABELS');

const KEYS: readonly (keyof RichTextLabels)[] = [
  'editor',
  'loading',
  'toolbar',
  'bold',
  'emphasis',
  'bulletList',
  'orderedList',
  'blockquote',
  'link',
  'clearFormat',
  'toolTip',
  'linkInsertTitle',
  'linkEditTitle',
  'linkUrl',
  'linkHint',
  'linkInvalid',
  'linkApply',
  'linkRemove',
  'cancel',
  'mentionList',
  'mentionLoading',
  'mentionEmpty',
  'mentionError',
  'remaining',
  'overLimit',
  'thread',
  'composer',
  'composerPlaceholder',
  'send',
  'sending',
  'sendHint',
  'sendFailed',
  'retry',
  'edit',
  'save',
  'delete',
  'actions',
  'editFailed',
  'deleteFailed',
  'deleteTitle',
  'deleteMessage',
  'edited',
  'editedAt',
  'you',
  'showEarlier',
  'empty',
  'emptyDetail',
];

/** 開發期設定錯誤（忘了提供文字或少了某一句）時直接丟出明確訊息，不靜默顯示空白。 */
export function assertRichTextLabels(labels: Partial<RichTextLabels> | null, owner = 'RichText'): RichTextLabels {
  if (!labels) throw new Error(`${owner}：缺少畫面文字。請在 providers 提供 RICH_TEXT_LABELS。`);
  const missing = KEYS.filter((key) => !labels[key]);
  if (missing.length > 0) {
    throw new Error(`${owner}：RICH_TEXT_LABELS 缺少 ${missing.map((k) => `「${k}」`).join('')}。`);
  }
  return labels as RichTextLabels;
}

/** 把 `{name}` 換成對應的值；沒給的佔位原樣留著。 */
export function formatRichTextLabel(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole));
}
