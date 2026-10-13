import { Component } from '@angular/core';
import { STATUS_TONE, StatusKey } from '@car-rental/theme-pack';
import { StatusChipComponent } from '@car-rental/ui';
import { DemoBlockComponent } from '../../showcase/demo-block.component';
import { ApiSection, ShowcasePageComponent } from '../../showcase/showcase-page.component';
import { detailOf } from '../../showcase/showcase-catalog';

const ENTRY = detailOf('status-chip');

/** StatusKey 的中文示範標籤（實際文字由使用端決定）。 */
const SAMPLE_LABELS: Record<StatusKey, string> = {
  success: '成功',
  approved: '已核准',
  completed: '已完成',
  active: '啟用中',
  online: '線上',
  info: '資訊',
  processing: '處理中',
  loading: '載入中',
  queued: '排隊中',
  pending: '待處理',
  draft: '草稿',
  inactive: '停用',
  archived: '已封存',
  offline: '離線',
  empty: '無資料',
  noResult: '查無結果',
  warning: '即將到期',
  error: '錯誤',
  critical: '嚴重',
  rejected: '已退回',
  cancelled: '已取消',
};

@Component({
  selector: 'app-status-chip-page',
  imports: [StatusChipComponent, ShowcasePageComponent, DemoBlockComponent],
  template: `
    <app-showcase-page [summary]="entry.summary" [whenToUse]="whenToUse" [avoid]="avoid" [source]="entry.source" [usage]="usage" [api]="api">
      <app-demo-block heading="5 種色調" description="每種色調各取一個代表狀態。">
        <div class="demo-row">
          @for (key of representatives; track key) {
            <lib-status-chip [status]="key" [label]="labels[key]" />
          }
        </div>
      </app-demo-block>

      <app-demo-block heading="全部 StatusKey" description="狀態語意對到色調的對照（theme-pack 的 STATUS_TONE）。業務狀態請對應到這些 key，不要新增色調。">
        <div class="tone-table">
          @for (key of keys; track key) {
            <div class="tone-table__row">
              <code>{{ key }}</code>
              <span class="tone-table__tone">{{ tones[key] }}</span>
              <lib-status-chip [status]="key" [label]="labels[key]" />
            </div>
          }
        </div>
      </app-demo-block>

      <app-demo-block heading="在表格與文字裡" description="狀態標籤跟著行高縮放，可以放在表格儲存格、清單或標題旁。">
        <ul class="demo-list">
          <li><span class="demo-list__title">官網改版</span><lib-status-chip status="processing" label="進行中" /></li>
          <li><span class="demo-list__title">年度教育訓練</span><lib-status-chip status="completed" label="已完成" /></li>
          <li><span class="demo-list__title">資料中心搬遷</span><lib-status-chip status="warning" label="延遲" /></li>
        </ul>
      </app-demo-block>
    </app-showcase-page>
  `,
  styleUrl: '../../showcase/demo-shared.scss',
  styles: `
    .tone-table {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
      gap: 0.5rem 1.5rem;
    }

    .tone-table__row {
      display: grid;
      grid-template-columns: 6.5rem 4.5rem auto;
      align-items: center;
      gap: 0.5rem;
      padding: 0.375rem 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }

    .tone-table__tone {
      font-size: 0.8125rem;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class StatusChipPageComponent {
  protected readonly entry = ENTRY;
  protected readonly labels = SAMPLE_LABELS;
  protected readonly tones = STATUS_TONE;
  protected readonly keys = Object.keys(STATUS_TONE) as StatusKey[];
  protected readonly representatives: StatusKey[] = ['completed', 'processing', 'draft', 'warning', 'error'];

  protected readonly whenToUse = ['顯示一筆資料目前的狀態（工單、專案、付款）。', '清單裡讓人一眼掃出異常（警告、錯誤）。'];
  protected readonly avoid = ['可以點、可以移除的標籤：用 Material chips 或篩選條件標籤。', '數量提示（未讀 3 則）：用 matBadge。'];

  protected readonly usage = `// 業務狀態 → StatusKey（使用端維護這張表）
const TONE: Record<WorkOrderStatus, StatusKey> = { todo: 'pending', doing: 'warning', done: 'completed', hold: 'inactive' };

<lib-status-chip [status]="TONE[order.status]" [label]="statusLabel(order)" />

<!-- 不想用元件時，直接寫 CONTRACT 的 class 也一樣 -->
<span class="ui-chip ui-chip--positive"><span class="ui-chip__dot"></span>已完成</span>`;

  protected readonly api: ApiSection[] = [
    {
      title: '輸入',
      rows: [
        { name: '[status]', type: 'StatusKey', default: '必填', description: '狀態語意，決定色調（positive／info／neutral／warning／danger）。' },
        { name: '[label]', type: 'string', default: '必填', description: '顯示文字。' },
      ],
    },
  ];
}
