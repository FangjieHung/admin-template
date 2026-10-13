import { DestroyRef, Directive, ElementRef, HostListener, Injector, inject, signal } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { HasUnsavedChanges } from '@admin-template/access';
import { openConfirmDialog } from '@admin-template/ui';

/**
 * 「明確存檔」分組共用的小工具：記住載入（或上次存檔）時的值，跟它不同就是有未儲存的變更。
 * 新專案複製設定頁時一起帶走；只有即時儲存的分組用不到。
 */
export class FormSnapshot<F extends FormGroup> {
  private initial: ReturnType<F['getRawValue']>;
  private readonly dirtyState = signal(false);
  readonly dirty = this.dirtyState.asReadonly();

  constructor(
    private readonly form: F,
    destroyRef: DestroyRef,
  ) {
    this.initial = form.getRawValue();
    const sub = form.valueChanges.subscribe(() => this.refresh());
    destroyRef.onDestroy(() => sub.unsubscribe());
  }

  /** 載入完成或存檔成功：目前的值變成新的基準。 */
  commit(): void {
    this.initial = this.form.getRawValue();
    this.dirtyState.set(false);
  }

  /** 捨棄變更：回到基準，並清掉欄位的「碰過」狀態（錯誤訊息跟著消失）。 */
  discard(): void {
    this.form.reset(this.initial);
    this.dirtyState.set(false);
  }

  private refresh(): void {
    this.dirtyState.set(JSON.stringify(this.form.getRawValue()) !== JSON.stringify(this.initial));
  }
}

/**
 * 依畫面順序找第一個無效的欄位，捲過去並聚焦。欄位的外層元素要標 `data-field="<控制項名稱>"`。
 * 回傳聚焦到的欄位名稱（找不到回 null）。
 */
export function focusFirstInvalid(root: HTMLElement, form: FormGroup, order: readonly string[]): string | null {
  for (const key of order) {
    if (!form.get(key)?.invalid) continue;
    const field = root.querySelector<HTMLElement>(`[data-field="${key}"]`);
    const target =
      field?.querySelector<HTMLElement>('input:not([type="hidden"]), textarea, .mat-mdc-select[tabindex]') ?? null;
    if (!target) continue;
    target.scrollIntoView?.({ block: 'center', behavior: 'instant' });
    target.focus({ preventScroll: true });
    return key;
  }
  return null;
}

/**
 * 明確存檔的分組元件繼承這個類別：切換分組或離開頁面（路由的 unsavedChangesGuard）時有未存的變更就先問，
 * 重新整理或關閉分頁時讓瀏覽器顯示它自己的提示（beforeunload）。
 */
@Directive()
export abstract class UnsavedChangesSection implements HasUnsavedChanges {
  protected readonly injector = inject(Injector);
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** 有未儲存的變更。 */
  abstract isDirty(): boolean;
  /** 捨棄變更（回到上次存檔的值）。 */
  abstract discardChanges(): void;

  async canLeave(): Promise<boolean> {
    if (!this.isDirty()) return true;
    const leave = await openConfirmDialog(this.injector, {
      title: '有尚未儲存的變更',
      message: '離開的話，剛剛修改的內容不會儲存。',
      confirmLabel: '捨棄變更',
      cancelLabel: '繼續編輯',
    });
    if (leave) this.discardChanges();
    return leave;
  }

  @HostListener('window:beforeunload', ['$event'])
  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.isDirty()) event.preventDefault();
  }
}
