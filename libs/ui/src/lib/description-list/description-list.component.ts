import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Directive,
  TemplateRef,
  computed,
  contentChildren,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { DESCRIPTION_LIST_LABELS, assertDescriptionListLabels } from './description-list-labels';

/** 描述清單的一列。 */
export interface DescriptionItem {
  label: string;
  /** null 或空字串時顯示 labels 的 `empty`。 */
  value: string | number | null;
  /** 值下方的灰色補充說明。 */
  hint?: string;
  /** 值旁邊多一顆複製鈕（編號、email、網址這類會被貼到別處的值）。 */
  copyable?: boolean;
  /** 自訂值的 template 用它對應（`<ng-template libDescriptionValue="status">`）；不給時用 label 對應。 */
  key?: string;
}

/** 複製完成時送出的資料。 */
export interface DescriptionCopiedEvent {
  item: DescriptionItem;
  text: string;
}

/** 某一列的值改用自訂內容（狀態標籤、連結）：`<ng-template libDescriptionValue="status" let-item>…</ng-template>`。 */
@Directive({ selector: 'ng-template[libDescriptionValue]' })
export class DescriptionValueDirective {
  /** 對應 item 的 `key`（沒有 key 時對應 `label`）。 */
  readonly libDescriptionValue = input.required<string>();
  readonly template = inject<TemplateRef<{ $implicit: DescriptionItem }>>(TemplateRef);
}

/** 複製完成的提示顯示多久（毫秒）。 */
export const DESCRIPTION_COPIED_DURATION = 2000;

/**
 * 描述清單：標籤＋值，用在詳情頁的摘要欄（1 欄）或概覽分頁（2 欄）。語意是 `<dl><dt><dd>`。
 *
 * - 空值顯示 labels 的 `empty`（「—」或「未填」）。
 * - `copyable` 的值旁邊有複製鈕；複製後按鈕換成勾號並念出 labels 的 `copied`，同時送出 `copied`。
 *   元件不依賴任何提示訊息服務，要顯示 toast 由使用端接 `(copied)` 自己決定。
 * - `columns` 給 2 時，窄螢幕（767px 以下）一律 1 欄。
 */
@Component({
  selector: 'lib-description-list',
  imports: [NgTemplateOutlet],
  templateUrl: './description-list.component.html',
  styleUrl: './description-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'lib-description-list',
    '[attr.data-columns]': 'columns()',
  },
})
export class DescriptionListComponent {
  readonly items = input.required<readonly DescriptionItem[]>();
  /** 1：摘要欄（標籤在上、值在下）；2：概覽分頁（兩欄並排）。窄螢幕一律 1 欄。 */
  readonly columns = input<1 | 2>(1);

  /** 複製成功。 */
  readonly copied = output<DescriptionCopiedEvent>();
  /** 複製失敗（瀏覽器不允許寫入剪貼簿）。 */
  readonly copyFailed = output<DescriptionItem>();

  protected readonly labels = assertDescriptionListLabels(inject(DESCRIPTION_LIST_LABELS, { optional: true }));
  private readonly clipboard = inject(Clipboard);
  private readonly valueTemplates = contentChildren(DescriptionValueDirective);

  protected readonly templateByKey = computed(() => {
    const map = new Map<string, TemplateRef<{ $implicit: DescriptionItem }>>();
    for (const dir of this.valueTemplates()) map.set(dir.libDescriptionValue(), dir.template);
    return map;
  });

  /** 剛複製完的那一列（顯示勾號與「已複製」）。 */
  protected readonly copiedIndex = signal<number | null>(null);
  private copiedTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.copiedTimer) clearTimeout(this.copiedTimer);
    });
  }

  protected templateOf(item: DescriptionItem): TemplateRef<{ $implicit: DescriptionItem }> | null {
    return this.templateByKey().get(item.key ?? item.label) ?? null;
  }

  protected isEmpty(item: DescriptionItem): boolean {
    return item.value === null || item.value === undefined || item.value === '';
  }

  protected copyLabel(item: DescriptionItem): string {
    return this.labels.copy.replace('{label}', item.label);
  }

  protected copy(item: DescriptionItem, index: number): void {
    const text = String(item.value ?? '');
    if (!this.clipboard.copy(text)) {
      this.copyFailed.emit(item);
      return;
    }
    this.copiedIndex.set(index);
    if (this.copiedTimer) clearTimeout(this.copiedTimer);
    this.copiedTimer = setTimeout(() => {
      this.copiedIndex.set(null);
      this.copiedTimer = null;
    }, DESCRIPTION_COPIED_DURATION);
    this.copied.emit({ item, text });
  }
}
