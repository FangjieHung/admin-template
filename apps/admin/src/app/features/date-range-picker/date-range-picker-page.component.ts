import { Component, signal } from '@angular/core';
import { provideNativeDateAdapter } from '@angular/material/core';
import { DualMonthRangePickerComponent, SelectedDateRange } from '@admin-template/ui';
import { fmtDate } from '../../core/date-utils';
import { rangePickerLabelProviders } from '../../shared/ui/component-label-providers';
import { DemoBlockComponent } from '../../showcase/demo-block.component';
import { ApiSection, ShowcasePageComponent } from '../../showcase/showcase-page.component';
import { detailOf } from '../../showcase/showcase-catalog';

const ENTRY = detailOf('date-range-picker');

function daysFromToday(n: number): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

@Component({
  selector: 'app-date-range-picker-page',
  imports: [DualMonthRangePickerComponent, ShowcasePageComponent, DemoBlockComponent],
  providers: [provideNativeDateAdapter(), ...rangePickerLabelProviders('專案期間')],
  template: `
    <app-showcase-page [summary]="entry.summary" [whenToUse]="whenToUse" [avoid]="avoid" [source]="entry.source" [usage]="usage" [api]="api">
      <app-demo-block heading="空白開始" description="點欄位開出兩個月曆：先點起日、再點迄日；滑過時預覽區間。">
        <div class="picker-box">
          <lib-dual-month-range-picker [start]="empty()?.start ?? null" [end]="empty()?.end ?? null" (rangeSelected)="empty.set($event)" />
        </div>
        <p class="demo-note" aria-live="polite">選擇結果：{{ describe(empty()) }}</p>
      </app-demo-block>

      <app-demo-block heading="帶入既有區間" description="start／end 有值時欄位直接顯示，打開時從起日所在月份開始。">
        <div class="picker-box">
          <lib-dual-month-range-picker [start]="preset().start" [end]="preset().end" (rangeSelected)="preset.set($event)" />
        </div>
        <p class="demo-note" aria-live="polite">選擇結果：{{ describe(preset()) }}</p>
      </app-demo-block>
    </app-showcase-page>
  `,
  styleUrl: '../../showcase/demo-shared.scss',
  styles: `
    .picker-box {
      max-width: 22rem;
    }
  `,
})
export class DateRangePickerPageComponent {
  protected readonly entry = ENTRY;
  protected readonly empty = signal<SelectedDateRange | null>(null);
  protected readonly preset = signal<SelectedDateRange>({ start: daysFromToday(3), end: daysFromToday(12) });

  protected describe(range: SelectedDateRange | null): string {
    if (!range) return '（尚未選擇）';
    const days = Math.round((range.end.getTime() - range.start.getTime()) / 86_400_000) + 1;
    return `${fmtDate(range.start)}–${fmtDate(range.end)}，共 ${days} 天`;
  }

  protected readonly whenToUse = ['選一段期間（專案期間、請假、報表區間），常常跨月。', '想在選的時候就看到區間長度與落點。'];
  protected readonly avoid = ['只選一天：用 mat-datepicker（見 Material 元件總覽）。', '篩選條件裡的日期區間：進階篩選已內建（含今天、本週）。'];

  protected readonly usage = `// 頁面 providers：DateAdapter 與月曆文字
providers: [provideNativeDateAdapter(), ...rangePickerLabelProviders('專案期間')]

<lib-dual-month-range-picker [start]="range()?.start ?? null" [end]="range()?.end ?? null" (rangeSelected)="range.set($event)" />`;

  protected readonly api: ApiSection[] = [
    {
      title: '輸入與輸出',
      rows: [
        { name: '[start]', type: 'Date | null', default: 'null', description: '起日。' },
        { name: '[end]', type: 'Date | null', default: 'null', description: '迄日。' },
        { name: '(rangeSelected)', type: 'SelectedDateRange', description: '點完迄日後送出 { start, end }。' },
      ],
    },
    {
      title: '注入',
      rows: [
        { name: 'DUAL_MONTH_RANGE_PICKER_LABELS', type: 'DualMonthRangePickerLabels', default: '必填', description: '欄位標籤、提示、上／下個月、月份標題樣板（{year}年{month}月）。' },
        { name: 'DateAdapter', type: 'DateAdapter<Date>', default: '必填', description: '用 provideNativeDateAdapter() 或專案自己的 adapter。' },
      ],
    },
  ];
}
