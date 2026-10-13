import {
  Component,
  ElementRef,
  InjectionToken,
  computed,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';

/** 頁首工具列的畫面文字。libs/ui 不內建使用者可見字串，由使用端提供。 */
export interface PageToolbarLabels {
  /** 放大鏡按鈕（收合時）與搜尋框預設的 placeholder，例：「搜尋」。 */
  search: string;
  /** 放大鏡按鈕（展開時），例：「收合搜尋」。 */
  collapseSearch: string;
  /** 例：「清除搜尋」。 */
  clearSearch: string;
  /** 送出鈕，例：「搜尋」。 */
  submitSearch: string;
  /** 有篩選時出現的清除鈕，例：「清除篩選」。 */
  clearFilters: string;
}

/**
 * 刻意沒有預設值（同 DUAL_MONTH_RANGE_PICKER_LABELS）：忘了提供時開發期直接報 NG0201。
 * admin 在 app.config 的根層提供。
 */
export const PAGE_TOOLBAR_LABELS = new InjectionToken<PageToolbarLabels>('PAGE_TOOLBAR_LABELS');

// 同頁若有多個 app-page-toolbar 實例，input id 須各自唯一，
// 供 toggle 按鈕的 aria-controls 指向。用模組層級遞增計數器，
// 比 inject(APP_ID) 更合適：APP_ID 是整個應用共用同一值，
// 無法區分同頁的多個元件實例。
let nextInstanceId = 0;

@Component({
  selector: 'lib-page-toolbar',
  imports: [FormsModule, MatButtonModule],
  templateUrl: './page-toolbar.component.html',
  styleUrls: ['./page-toolbar.component.scss'],
})
export class PageToolbarComponent {
  protected readonly t = inject(PAGE_TOOLBAR_LABELS);
  readonly query = model<string>('');
  /** 未指定時用 labels 的 search。 */
  readonly placeholder = input<string | undefined>(undefined);
  protected readonly placeholderText = computed(() => this.placeholder() ?? this.t.search);
  readonly activeFilterCount = input<number>(0);
  readonly showSearch = input<boolean>(true);
  readonly clearAll = output<void>();
  readonly searchSubmit = output<string>();

  readonly expanded = signal(false);
  protected readonly searchInputId = `lib-page-toolbar-search-${nextInstanceId++}`;

  // 不可用 viewChild.required：input 位於 @if (showSearch()) 內，
  // showSearch() 為 false 時元素不存在，required 會拋錯。
  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private readonly toggleRef = viewChild<ElementRef<HTMLButtonElement>>('toggleBtn');

  toggle(): void {
    if (this.expanded()) {
      this.collapse();
      return;
    }
    this.expanded.set(true);
    // 必須同步呼叫。包進 setTimeout / afterNextRender 會讓 iOS Safari 不喚起軟鍵盤。
    this.inputRef()?.nativeElement.focus();
  }

  onEscape(): void {
    this.collapse();
    // Esc 是鍵盤操作，焦點須回到觸發器，否則鍵盤使用者會失去位置。
    this.toggleRef()?.nativeElement.focus();
  }

  private collapse(): void {
    this.query.set('');
    this.expanded.set(false);
    this.inputRef()?.nativeElement.blur();
  }

  clearKeepFocus(): void {
    this.query.set('');
    // 清空後游標留在框內，讓使用者直接重打。
    this.inputRef()?.nativeElement.focus();
  }

  submitQuery(): void {
    const query = this.query().trim();
    if (query) {
      this.searchSubmit.emit(query);
    }
  }

  collapseIfEmpty(): void {
    if (!this.query().trim()) {
      this.expanded.set(false);
    }
  }
}
