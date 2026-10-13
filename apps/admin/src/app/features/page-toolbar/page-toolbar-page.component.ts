import { Component, computed, signal } from '@angular/core';
import { FilterOption, FilterSelectComponent, PageToolbarComponent } from '@car-rental/ui';
import { HeaderToolbarDirective } from '../../layout/header/header-toolbar-slot';
import { LIST_TOOLBAR_LABEL_PROVIDERS } from '../../shared/ui/list-toolbar-labels';
import { DEMO_PROJECTS } from '../../showcase/demo-data';
import { DemoBlockComponent } from '../../showcase/demo-block.component';
import { ApiSection, ShowcasePageComponent } from '../../showcase/showcase-page.component';
import { detailOf } from '../../showcase/showcase-catalog';

type ProgressFilter = 'active' | 'done';

const ENTRY = detailOf('page-toolbar');

@Component({
  selector: 'app-page-toolbar-page',
  imports: [PageToolbarComponent, FilterSelectComponent, HeaderToolbarDirective, ShowcasePageComponent, DemoBlockComponent],
  providers: [...LIST_TOOLBAR_LABEL_PROVIDERS],
  templateUrl: './page-toolbar-page.component.html',
  styleUrl: '../../showcase/demo-shared.scss',
})
export class PageToolbarPageComponent {
  protected readonly entry = ENTRY;

  protected readonly query = signal('');
  protected readonly owner = signal<string | null>(null);
  protected readonly progress = signal<ProgressFilter | null>(null);
  protected readonly submitted = signal<string | null>(null);

  protected readonly ownerOptions: FilterOption[] = DEMO_PROJECTS.map((p) => ({ value: p.owner, label: p.owner }));
  protected readonly progressOptions: FilterOption<ProgressFilter>[] = [
    { value: 'active', label: '進行中' },
    { value: 'done', label: '已完成' },
  ];

  protected readonly activeFilterCount = computed(() => (this.owner() ? 1 : 0) + (this.progress() ? 1 : 0));

  protected readonly rows = computed(() => {
    const q = this.query().trim();
    return DEMO_PROJECTS.filter(
      (p) =>
        (!q || p.name.includes(q)) &&
        (!this.owner() || p.owner === this.owner()) &&
        (!this.progress() || (this.progress() === 'done') === (p.progress === 100)),
    );
  });

  protected clearAll(): void {
    this.owner.set(null);
    this.progress.set(null);
  }

  protected readonly whenToUse = [
    '清單頁的頁首：一個搜尋框加一兩個最常用的單選篩選。',
    '篩選條件不多、每個條件只選一個值。',
  ];
  protected readonly avoid = ['條件多、需要區間或複選：改用進階篩選，兩者可以並存（見資料表頁）。'];

  protected readonly usage = `<!-- 頁面模板：用 appHeaderToolbar 把工具列放進頁首 -->
<ng-template appHeaderToolbar>
  <lib-page-toolbar [(query)]="query" [activeFilterCount]="activeFilterCount()" (clearAll)="clearAll()">
    <lib-filter-select filters label="負責人" [options]="ownerOptions" [(value)]="owner" />
  </lib-page-toolbar>
</ng-template>

// 頁面 providers：工具列文字（PAGE_TOOLBAR_LABELS、FILTER_SELECT_LABELS）
providers: [...LIST_TOOLBAR_LABEL_PROVIDERS]`;

  protected readonly api: ApiSection[] = [
    {
      title: 'lib-page-toolbar',
      rows: [
        { name: '[(query)]', type: 'string', default: "''", description: '搜尋文字；輸入時即時更新。' },
        { name: '[placeholder]', type: 'string', default: 'labels.search', description: '搜尋框的提示文字。' },
        { name: '[activeFilterCount]', type: 'number', default: '0', description: '已套用的篩選數；大於 0 時顯示「清除篩選」。' },
        { name: '[showSearch]', type: 'boolean', default: 'true', description: '只要篩選、不要搜尋時設 false。' },
        { name: '(searchSubmit)', type: 'string', description: '按 Enter 或送出鈕（伺服器搜尋用）。' },
        { name: '(clearAll)', type: 'void', description: '按下「清除篩選」。' },
        { name: '[filters]（內容投影）', type: '—', description: '放在搜尋框旁的篩選元件，加上 filters 屬性。' },
        { name: 'PAGE_TOOLBAR_LABELS', type: 'PageToolbarLabels', default: '必填（注入）', description: '搜尋、收合、清除等文字。' },
      ],
    },
    {
      title: 'lib-filter-select',
      rows: [
        { name: 'label', type: 'string', default: '必填', description: '欄位名稱，也是按鈕上的文字。' },
        { name: '[options]', type: 'FilterOption<T>[]', default: '必填', description: '{ value, label } 清單。' },
        { name: '[(value)]', type: 'T | null', default: 'null', description: '目前選的值；null 代表「全部」。' },
        { name: 'FILTER_SELECT_LABELS', type: 'FilterSelectLabels', default: '必填（注入）', description: '「全部」選項的文字。' },
      ],
    },
  ];
}
