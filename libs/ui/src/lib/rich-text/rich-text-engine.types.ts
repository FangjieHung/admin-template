import type { EditorView } from 'prosemirror-view';
import type { RichTextCommand, RichTextContent } from './rich-text.types';

/**
 * 編輯器引擎（rich-text-engine.ts，ProseMirror）與元件之間的介面。元件只 import 這個型別檔，
 * 引擎本身在第一次建立編輯器時才動態載入（獨立的 lazy chunk，不會進 Initial bundle，也不會跟著 barrel 進其他頁面）。
 */

/** 工具列按鈕目前的狀態（aria-pressed）。 */
export interface RichTextToolbarState {
  bold: boolean;
  emphasis: boolean;
  bulletList: boolean;
  orderedList: boolean;
  blockquote: boolean;
  link: boolean;
}

/** 游標前面出現 `@查詢字`：提及清單要打開（或更新查詢）。 */
export interface MentionTrigger {
  query: string;
  /** `@` 的位置（文件座標）；插入提及時用來取代 `@查詢字`。 */
  from: number;
  to: number;
  /** `@` 在畫面上的位置（清單錨在它下方）。 */
  rect: { left: number; top: number; bottom: number };
}

export interface RichTextEngineCallbacks {
  /** 內容改了（使用者輸入、貼上、指令；`setContent` 不會觸發）。 */
  onChange(content: RichTextContent): void;
  /** 選取範圍或內容改變後工具列的狀態。 */
  onToolbar(state: RichTextToolbarState): void;
  onFocus(focused: boolean): void;
  /**
   * 提及：游標前面是 `@查詢字`（null：不是了，清單要關）。中文輸入法組字中不會呼叫，組字確定之後才依確定的字呼叫；
   * 同一個 `@` 的查詢字沒變也不會重複呼叫。
   */
  onMention(trigger: MentionTrigger | null): void;
  /** 清單開著時的按鍵（↑↓ Enter Tab Esc）；回傳 true 代表元件處理了（不交給編輯器）。 */
  onMentionKey(event: KeyboardEvent): boolean;
  /** ⌘↵／Ctrl+↵；回傳 true 代表處理了。 */
  onSubmitShortcut(): boolean;
}

export interface RichTextEngineOptions {
  element: HTMLElement;
  content: string;
  editable: boolean;
  placeholder: string;
  /** 編輯區（contenteditable）一開始就有的屬性：role、aria-label、id… */
  attributes: Record<string, string>;
  callbacks: RichTextEngineCallbacks;
}

export interface RichTextEngine {
  /** ProseMirror 的 view（測試用來模擬輸入；元件本身不碰）。 */
  readonly view: EditorView;
  /** 換內容（表單 writeValue）；不觸發 onChange。 */
  setContent(html: string): void;
  setEditable(editable: boolean): void;
  setPlaceholder(text: string): void;
  /** 直接設定編輯區的屬性（aria-*）；值是 null 時移除。 */
  setAttributes(attributes: Record<string, string | null>): void;
  run(command: RichTextCommand): void;
  /** 游標所在（或選取範圍內）的連結網址；沒有時 null。 */
  currentLink(): string | null;
  /** 有選取文字時把它設成連結；沒選取時在游標處插入網址本身當連結文字；游標在連結上時改它的網址。 */
  applyLink(href: string): void;
  removeLink(): void;
  /** 用提及標記取代 `@查詢字`，後面補一個空白。 */
  insertMention(trigger: MentionTrigger, id: string, label: string): void;
  /** 使用者按 Esc 關掉清單：同一個 `@` 不再打開，直到打了新的 `@`。 */
  dismissMention(): void;
  focus(): void;
  content(): RichTextContent;
  destroy(): void;
}

export type CreateRichTextEngine = (options: RichTextEngineOptions) => RichTextEngine;
