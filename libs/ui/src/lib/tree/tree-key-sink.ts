import { DestroyRef, signal } from '@angular/core';

/** 預輸入的字串在停手多久之後清空。 */
export const TREE_TYPEAHEAD_RESET_MS = 500;

/**
 * lib-tree／lib-tree-table 的鍵盤接收器（內部用）。
 *
 * 作業系統的輸入法只在「可編輯的元素」有焦點時啟動：焦點停在 li／tr 上時，注音、倉頡打出來的是英文字母。
 * 所以兩個元件的鍵盤焦點實際放在一個看不見的 `<input>` 上（整個元件唯一的 tab stop），
 * 用 `aria-activedescendant` 指向目前的節點（輔助科技念的是那個 treeitem／row，不是輸入框）。
 *
 * - 英數：keydown 拿到單一字元就直接當預輸入（preventDefault，輸入框保持空白）。
 * - 輸入法：keydown 是 `Process`／keyCode 229 或 `isComposing` 時不攔，讓組字在輸入框裡進行；
 *   組字中輸入框顯示成一個小框（看得到注音與底線）；`compositionend` 拿確定的字串去比對。
 * - 聽寫、表情符號面板等沒有組字事件、直接插入文字的輸入：`input` 事件裡取出文字一樣當預輸入。
 */
export class TreeKeySink {
  /** 正在組字：範本把輸入框畫成看得到的小框。 */
  readonly composing = signal(false);
  /** 鍵盤焦點在元件上，而且是鍵盤（不是滑鼠點擊）帶進來的：目前節點畫焦點框（同 :focus-visible）。 */
  readonly focusVisible = signal(false);

  private buffer = '';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private viaPointer = false;
  /** compositionend 之後同一輪的 input 事件（Safari 在 compositionend 後才插入確定的字）不要再算一次。 */
  private justComposed = false;

  constructor(
    private readonly onQuery: (query: string) => void,
    destroyRef: DestroyRef,
  ) {
    destroyRef.onDestroy(() => this.reset());
  }

  /** 輸入法正在處理這個按鍵（組字、選字）：元件不要攔，也不要拿來導覽。 */
  static isImeKey(event: KeyboardEvent): boolean {
    return event.isComposing || event.keyCode === 229 || event.key === 'Process';
  }

  /** 單一可列印字元（以 code point 計）且不是空白：可以當預輸入。 */
  static isPrintable(event: KeyboardEvent): boolean {
    return [...event.key].length === 1 && event.key.trim() !== '';
  }

  pointerDown(): void {
    this.viaPointer = true;
  }

  focus(): void {
    this.focusVisible.set(!this.viaPointer);
    this.viaPointer = false;
  }

  blur(input: HTMLInputElement): void {
    this.focusVisible.set(false);
    this.composing.set(false);
    input.value = '';
  }

  /** 處理了一個鍵盤操作：之後的焦點框照鍵盤的樣子畫。 */
  keyboard(): void {
    this.viaPointer = false;
    this.focusVisible.set(true);
  }

  /** keydown 拿到的英數字元。 */
  type(char: string): void {
    this.keyboard();
    this.push(char);
  }

  compositionStart(): void {
    this.keyboard();
    this.composing.set(true);
  }

  compositionEnd(event: CompositionEvent, input: HTMLInputElement): void {
    this.composing.set(false);
    // 只認 compositionend 的 data：取消組字（Esc）時是空字串，輸入框裡可能還留著注音。
    const text = event.data ?? '';
    input.value = '';
    this.justComposed = true;
    setTimeout(() => (this.justComposed = false));
    if (text.trim()) this.push(text.trim());
  }

  input(event: Event, input: HTMLInputElement): void {
    const e = event as InputEvent;
    if (this.composing() || e.isComposing) return;
    const text = input.value;
    input.value = '';
    if (this.justComposed || e.inputType === 'insertFromComposition' || e.inputType === 'insertCompositionText') return;
    if (text.trim()) {
      this.keyboard();
      this.push(text.trim());
    }
  }

  private push(text: string): void {
    this.buffer += text;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.reset(), TREE_TYPEAHEAD_RESET_MS);
    this.onQuery(this.buffer);
  }

  private reset(): void {
    this.buffer = '';
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
