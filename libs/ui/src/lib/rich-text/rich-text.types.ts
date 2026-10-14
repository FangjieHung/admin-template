import type { Observable } from 'rxjs';

/**
 * 富文字編輯器（lib-rich-text-editor）、顯示（lib-rich-text-view）與留言串（lib-comment-thread）對外的型別。
 *
 * 值的格式是 HTML 字串，只會出現下面這些標籤（編輯器的 schema 與顯示元件的白名單相同）：
 * `p`、`br`、`strong`、`em`、`ul`、`ol`、`li`、`blockquote`、`a[href]`（只接受 http、https、mailto），
 * 以及提及標記 `<span data-type="mention" data-id="…" data-label="…">@名字</span>`。空白內容是空字串。
 */

/** 可以被 @提及的人（建議清單的一列）。 */
export interface MentionCandidate {
  id: string;
  /** 顯示名稱；插入後畫成「@名字」。 */
  name: string;
  /** 第二行（部門、職稱、Email）。 */
  description?: string;
  /** 頭像圖片網址；沒有時畫名字的第一個字。 */
  avatar?: string;
}

/**
 * 提及的資料來源：輸入 `@` 之後每次查詢字改變（中文輸入法組字確定之後）呼叫一次，`query` 是 `@` 後面的字（可能是空字串）。
 * 回傳 Promise 或 Observable（Observable 只取最新一次查詢的結果，舊的查詢會被取消訂閱）。
 */
export type MentionSource = (query: string) => Promise<readonly MentionCandidate[]> | Observable<readonly MentionCandidate[]>;

/** 工具列的指令。 */
export type RichTextCommand = 'bold' | 'emphasis' | 'bulletList' | 'orderedList' | 'blockquote' | 'clearFormat';

/** 編輯器目前的內容（`(contentChange)` 送出；表單值只有 `html`）。 */
export interface RichTextContent {
  /** HTML 字串；沒有內容時是空字串。 */
  html: string;
  /** 純文字（提及寫成「@名字」、段落之間換行）。 */
  text: string;
  /** 被提及的人的 id，依出現順序、不重複。 */
  mentions: readonly string[];
  /** 字數：純文字的字元數（不算段落之間的換行；提及算「@名字」的長度）。 */
  length: number;
}

/** 留言的作者。 */
export interface CommentAuthor {
  id: string;
  name: string;
  /** 頭像圖片網址；沒有時畫名字的第一個字。 */
  avatar?: string;
}

/** 一則留言（使用端的資料；元件不自己存）。 */
export interface CommentItem {
  id: string;
  author: CommentAuthor;
  /** 內容（富文字編輯器產生的 HTML；顯示前一律再經白名單清理）。 */
  html: string;
  /** 建立時間：毫秒、Date 或 ISO 8601 字串。 */
  createdAt: number | Date | string;
  /** 有值就顯示「已編輯」（hover 看編輯時間）。 */
  editedAt?: number | Date | string | null;
}

/**
 * 留言串送給使用端的事件共用的部分：處理完成前元件維持「送出中」。
 * 使用端在事件處理函式裡**同步**呼叫 `respondWith(promise)`：resolve 代表成功（送出後清空輸入框、編輯後回到檢視），
 * reject 代表失敗（保留內容、顯示錯誤，可以重試）。沒有呼叫就當作馬上成功。
 */
export interface CommentEventBase {
  respondWith(work: Promise<unknown>): void;
}

/** 送出新留言。 */
export interface CommentSubmitEvent extends CommentEventBase {
  html: string;
  text: string;
  mentions: readonly string[];
}

/** 儲存編輯過的留言。 */
export interface CommentEditEvent extends CommentEventBase {
  id: string;
  html: string;
  text: string;
  mentions: readonly string[];
}

/** 刪除留言（使用者已在確認對話框按了「刪除」）。 */
export interface CommentDeleteEvent extends CommentEventBase {
  id: string;
}
