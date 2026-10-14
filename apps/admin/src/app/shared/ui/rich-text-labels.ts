import { Provider } from '@angular/core';
import { RICH_TEXT_LABELS, RichTextLabels } from '@admin-template/ui';

/**
 * 富文字編輯器、顯示與留言串（lib-rich-text-editor、lib-rich-text-view、lib-comment-thread）的畫面文字。
 * 用到它們的頁面在自己的 `providers` 加上這組；不放 app.config 根層，理由同 component-label-providers.ts。
 */
export const ZH_TW_RICH_TEXT: RichTextLabels = {
  editor: '內容',
  loading: '編輯器載入中',
  toolbar: '文字格式',
  bold: '粗體',
  emphasis: '斜體',
  bulletList: '項目清單',
  orderedList: '編號清單',
  blockquote: '引用',
  link: '連結',
  clearFormat: '清除格式',
  toolTip: '{label}（{keys}）',
  linkInsertTitle: '插入連結',
  linkEditTitle: '編輯連結',
  linkUrl: '網址',
  linkHint: 'http://、https:// 或 mailto: 開頭（網域與 Email 會自動補上）',
  linkInvalid: '只接受 http、https 或 mailto 連結',
  linkApply: '套用',
  linkRemove: '移除連結',
  cancel: '取消',
  mentionList: '提及同事',
  mentionLoading: '搜尋中…',
  mentionEmpty: '找不到「{query}」',
  mentionError: '搜尋失敗，請再輸入一次',
  remaining: '剩 {count} 字',
  overLimit: '超過 {count} 字，請刪減',
  thread: '留言',
  composer: '新增留言',
  composerPlaceholder: '寫下留言，輸入 @ 提及同事',
  send: '送出',
  sending: '送出中…',
  sendHint: '{keys} 送出',
  sendFailed: '送出失敗，內容還在，可以再試一次',
  retry: '重試',
  edit: '編輯',
  save: '儲存',
  delete: '刪除',
  actions: '{name} 的留言動作',
  editFailed: '儲存失敗，請再試一次',
  deleteFailed: '刪除失敗，請再試一次',
  deleteTitle: '刪除留言？',
  deleteMessage: '刪除後無法復原。',
  edited: '已編輯',
  editedAt: '編輯於 {time}',
  you: '（你）',
  showEarlier: '顯示較早的 {count} 則',
  empty: '還沒有留言',
  emptyDetail: '有問題或進度更新就留言；輸入 @ 可以提及同事，對方會收到通知。',
};

export const RICH_TEXT_LABEL_PROVIDERS: Provider[] = [{ provide: RICH_TEXT_LABELS, useValue: ZH_TW_RICH_TEXT }];
