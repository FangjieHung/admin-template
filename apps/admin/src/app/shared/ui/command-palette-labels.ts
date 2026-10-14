import { Provider } from '@angular/core';
import { COMMAND_PALETTE_LABELS, CommandPaletteLabels } from '@admin-template/ui';

/**
 * 指令面板（lib-command-palette）的畫面文字。用到它的地方（頁首的全域指令面板、展示頁）在自己的 `providers`
 * 加上這組；不放 app.config 根層，理由同 component-label-providers.ts。
 *
 * 文字直接寫在這裡、不放 core/i18n/zh-tw.ts：那份字典被殼層 import，整份在 Initial bundle 裡
 * （esbuild 把每個中文字輸出成 6 bytes 的跳脫序列），這些句子只有指令面板（lazy chunk）需要。
 */
export const ZH_TW_COMMAND_PALETTE: CommandPaletteLabels = {
  input: '搜尋頁面、工單或動作',
  placeholder: '搜尋頁面、工單或動作…',
  subPlaceholder: '在「{title}」中搜尋…',
  results: '搜尋結果',
  recent: '最近使用',
  loading: '搜尋中…',
  groupError: '{group}暫時無法搜尋，請稍後再試',
  noResults: '找不到「{query}」',
  noResultsHint: '換個關鍵字，或輸入工單編號（例如 TK-2048）',
  resultCount: '{count} 個結果',
  current: '目前使用中',
  hasChildren: '有子選項',
  back: '返回上一層（{title}）',
  close: '取消',
  hintNavigate: '選擇',
  hintRun: '執行',
  hintClose: '關閉',
  hintBack: '返回',
};

export const COMMAND_PALETTE_LABEL_PROVIDERS: Provider[] = [{ provide: COMMAND_PALETTE_LABELS, useValue: ZH_TW_COMMAND_PALETTE }];

/** 全域指令面板（頁首 ⌘K）的分組、動作與對話框文字。 */
export const ZH_TW_APP_COMMANDS = {
  dialog: '指令面板',
  pages: '頁面',
  tickets: '工單',
  actions: '動作',
  home: '首頁',
  settings: '設定',
  plannedTemplates: '規劃中的樣板',
  newTicket: '新增工單',
  newTicketHint: '開啟空白的工單表單',
  texture: '切換質地',
  color: '切換配色',
  identity: '切換身分',
  notifications: '開啟通知中心',
  notificationsHint: '查看指派、提及與系統公告',
  currentPrefix: '目前：',
  colorWillChange: '配色會改成「{color}」',
  noRoles: '沒有角色',
  signedOut: '未登入',
  unassigned: '未指派',
} as const;
