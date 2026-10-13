import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { AccessService, CanDirective } from '@admin-template/access';
import {
  ActivityTimelineComponent,
  AsyncStateComponent,
  AsyncStatus,
  DescriptionCopiedEvent,
  DescriptionItem,
  DescriptionListComponent,
  DescriptionValueDirective,
  DetailActionDirective,
  DetailActionsDirective,
  DetailAsideDirective,
  DetailLayoutComponent,
  DetailTitleDirective,
  StatusChipComponent,
  ToastService,
} from '@admin-template/ui';
import { FEEDBACK_STATE_LABEL_PROVIDERS, TOAST_PROVIDERS } from '../../shared/ui/component-label-providers';
import {
  ACTIVITY_TIMELINE_LABEL_PROVIDERS,
  DESCRIPTION_LIST_LABEL_PROVIDERS,
  DETAIL_LAYOUT_LABEL_PROVIDERS,
} from '../../shared/ui/detail-labels';
import { DemoBlockComponent } from '../../showcase/demo-block.component';
import { ApiSection, ShowcasePageComponent } from '../../showcase/showcase-page.component';
import { detailOf } from '../../showcase/showcase-catalog';
import { DEMO_ACTIVITY_KINDS, makeDemoActivity } from '../activity-log/activity-log-demo-data';

const ENTRY = detailOf('detail-layout');

type TicketTab = 'overview' | 'related' | 'activity' | 'files';
type ErrorDemo = 'not-found' | 'error' | 'ready';

/** 示範身分：看「編輯／指派／關閉工單／刪除」依權限出現或消失（同 /components/access-control 的帳號）。 */
const DEMO_IDENTITIES = [
  { id: 'u-admin', label: '林雅婷・系統管理員' },
  { id: 'u-member', label: '王小明・成員' },
  { id: 'u-viewer', label: '張美玲・檢視者' },
];

/** 詳情頁版型展示頁（/components/detail-layout）：一張示範工單的詳情頁、載入中、錯誤與找不到。 */
@Component({
  selector: 'app-detail-layout-page',
  imports: [
    RouterLink,
    MatButtonModule,
    MatSlideToggleModule,
    MatTabsModule,
    CanDirective,
    DetailLayoutComponent,
    DetailTitleDirective,
    DetailActionsDirective,
    DetailActionDirective,
    DetailAsideDirective,
    DescriptionListComponent,
    DescriptionValueDirective,
    StatusChipComponent,
    ActivityTimelineComponent,
    AsyncStateComponent,
    ShowcasePageComponent,
    DemoBlockComponent,
  ],
  providers: [
    ...DETAIL_LAYOUT_LABEL_PROVIDERS,
    ...DESCRIPTION_LIST_LABEL_PROVIDERS,
    ...ACTIVITY_TIMELINE_LABEL_PROVIDERS,
    ...FEEDBACK_STATE_LABEL_PROVIDERS,
    ...TOAST_PROVIDERS,
  ],
  templateUrl: './detail-layout-page.component.html',
  styleUrls: ['../../showcase/demo-shared.scss', './detail-layout-page.component.scss'],
})
export class DetailLayoutPageComponent {
  private readonly toast = inject(ToastService);
  protected readonly access = inject(AccessService);
  protected readonly entry = ENTRY;

  // ---- 示範控制 ----
  protected readonly loading = signal(false);
  protected readonly identities = DEMO_IDENTITIES;
  protected readonly lastAction = signal('（尚未操作）');
  protected readonly tab = signal<TicketTab>('overview');

  // ---- 工單資料（示範） ----
  protected readonly summaryItems: DescriptionItem[] = [
    { label: '編號', value: 'TK-2048', copyable: true },
    { label: '狀態', value: '處理中', key: 'status' },
    { label: '優先順序', value: '高' },
    { label: '負責人', value: '王宗翰' },
    { label: '申請人', value: '李佩君', hint: '資訊室・分機 2231' },
    { label: '分類', value: '硬體／印表機' },
    { label: '期限', value: '2026/10/15 17:00', hint: '剩不到 2 天' },
    { label: '聯絡電話', value: null },
  ];
  protected readonly overviewItems: DescriptionItem[] = [
    { label: '地點', value: '3 樓影印區' },
    { label: '設備', value: 'LaserJet M404' },
    { label: '資產編號', value: 'AS-1187', copyable: true },
    { label: '影響人數', value: 12 },
    { label: '回報管道', value: '電子郵件' },
    { label: '關聯專案', value: 'PRJ-017 辦公室網路更新' },
    { label: '重現步驟', value: '從任何一台電腦送出列印，工作停在佇列；印表機面板可以列印測試頁。' },
    { label: '備註', value: '' },
  ];
  protected readonly related = [
    { code: 'TK-2031', title: '同一台印表機無法掃描到資料夾', status: 'completed', statusLabel: '已完成' },
    { code: 'TK-2044', title: '3 樓網路間歇斷線', status: 'processing', statusLabel: '處理中' },
    { code: 'PRJ-017', title: '辦公室網路更新（專案）', status: 'pending', statusLabel: '進行中' },
  ] as const;
  protected readonly files = [
    { name: '錯誤畫面.png', meta: '214 KB・張美玲' },
    { name: '網路設定.pdf', meta: '1.2 MB・王宗翰' },
  ];
  protected readonly kinds = DEMO_ACTIVITY_KINDS;
  private readonly allActivity = makeDemoActivity(new Date(), 16);
  protected readonly activityCount = signal(8);
  protected readonly loadingMoreActivity = signal(false);
  protected readonly activity = computed(() => this.allActivity.slice(0, this.activityCount()));
  protected readonly hasMoreActivity = computed(() => this.activityCount() < this.allActivity.length);

  // ---- 錯誤與找不到 ----
  protected readonly errorDemo = signal<ErrorDemo>('not-found');
  protected readonly errorStatus = signal<AsyncStatus>('empty');
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.timer) clearTimeout(this.timer);
    });
  }

  protected act(name: string): void {
    this.lastAction.set(`按下「${name}」`);
  }

  protected switchTo(userId: string): void {
    this.access.signIn(userId);
  }

  protected onCopied(event: DescriptionCopiedEvent): void {
    this.toast.success(`已複製${event.item.label}「${event.text}」`);
  }

  protected loadMoreActivity(): void {
    this.loadingMoreActivity.set(true);
    this.timer = setTimeout(() => {
      this.activityCount.update((n) => n + 8);
      this.loadingMoreActivity.set(false);
    }, 700);
  }

  protected showErrorDemo(demo: ErrorDemo): void {
    this.errorDemo.set(demo);
    this.errorStatus.set(demo === 'not-found' ? 'empty' : demo === 'error' ? 'error' : 'ready');
  }

  protected retry(): void {
    this.errorStatus.set('loading');
    this.timer = setTimeout(() => this.showErrorDemo('ready'), 900);
  }

  protected readonly whenToUse = [
    '打開一筆資料（工單、專案、聯絡人）的整頁：標題、狀態、主要動作、分頁與摘要。',
    '摘要欄位要一直看得到；窄螢幕時摘要移到頁首下方、分頁上方。',
    '動作很多：重要的放頁首，其餘收進「更多」；窄螢幕自動只留第一個。',
  ];
  protected readonly avoid = [
    '只是一張卡片的小資訊：直接用卡片＋描述清單（lib-description-list）。',
    '編輯表單本身：用表單頁；詳情頁的「編輯」按鈕再導過去或開對話框。',
    '並排看清單與內容：用分割檢視（lib-responsive-panel）。',
  ];

  protected readonly usage = `// 頁面的 providers：畫面文字
providers: [
  { provide: DETAIL_LAYOUT_LABELS, useValue: { more: '更多動作', loading: '載入中' } },
  { provide: DESCRIPTION_LIST_LABELS, useValue: { empty: '未填', copy: '複製{label}', copied: '已複製' } },
]

<lib-detail-layout [loading]="loading()" asideLabel="摘要">
  <a libDetailBack routerLink="/tickets">返回工單清單</a>
  <h2 libDetailTitle class="ui-text-title">工單 #TK-2048 印表機無法連線</h2>
  <div libDetailMeta>
    <lib-status-chip status="processing" label="處理中" />
    <span class="ui-text-numeric">TK-2048</span>
  </div>

  <div libDetailActions>
    <button matButton="filled" *libCan="'ticket:edit'" (click)="edit()">編輯</button>
    <!-- 窄螢幕收進「更多」 -->
    <button matButton="outlined" libDetailSecondary (click)="assign()">指派</button>
    <!-- 一律在「更多」 -->
    <button libDetailOverflow (click)="print()">
      <span class="material-symbols-rounded" aria-hidden="true">print</span>列印
    </button>
  </div>

  <nav mat-tab-nav-bar libDetailTabs [tabPanel]="panel">…</nav>
  <mat-tab-nav-panel #panel>…主內容（預設插槽）…</mat-tab-nav-panel>

  <section libDetailAside class="ui-card p-4">
    <lib-description-list [items]="summary" (copied)="toast.success('已複製')">
      <ng-template libDescriptionValue="status" let-item>
        <lib-status-chip status="processing" [label]="item.value" />
      </ng-template>
    </lib-description-list>
  </section>
</lib-detail-layout>`;

  protected readonly api: ApiSection[] = [
    {
      title: '插槽（lib-detail-layout）',
      rows: [
        { name: '[libDetailBack]', type: '元素', description: '返回連結或麵包屑。' },
        { name: '[libDetailTitle]', type: '元素', description: '標題（建議 h2.ui-text-title）；精簡頁首沒給 compactTitle 時取它的文字。' },
        { name: '[libDetailMeta]', type: '元素', description: '編號、狀態標籤、建立者等一列小資訊，會排成可換行的一列。' },
        { name: '[libDetailActions]', type: '元素', description: '主要動作的容器。裡面的按鈕可標 libDetailSecondary（窄螢幕收進「更多」）或 libDetailOverflow（一律在「更多」）。' },
        { name: '[libDetailTabs]', type: '元素', description: 'mat-tab-nav-bar 或 mat-tab-group；窄螢幕時分頁列改成原生水平捲動。' },
        { name: '（預設）', type: '內容', description: '主內容區。' },
        { name: '[libDetailAside]', type: '元素', description: '摘要側欄；不放時主內容占滿寬度。' },
      ],
    },
    {
      title: '輸入（lib-detail-layout）',
      rows: [
        { name: '[loading]', type: 'boolean', default: 'false', description: '頁首（標題、資訊列、動作）與摘要欄換成依形狀的骨架；主內容與分頁不變。' },
        { name: '[asideWidth]', type: 'string', default: "'20rem'", description: '寬螢幕時摘要欄的寬度。' },
        { name: '[asideLabel]', type: 'string', default: "''", description: '摘要欄 <aside> 的無障礙名稱。' },
        { name: '[compactHeader]', type: 'boolean', default: 'true', description: '頁首捲出畫面後，捲動容器頂端出現精簡列（標題＋第一個主要動作＋更多）。' },
        { name: '[compactTitle]', type: 'string', default: "''", description: '精簡列的標題；不給時取 [libDetailTitle] 的文字。' },
        { name: '[stickyTop]', type: 'string', default: "'0px'", description: '精簡列距離捲動容器頂端的距離（上方有固定頁首時設它的高度）。' },
        { name: '[stackQuery]', type: 'string', default: "'(max-width: 1280px)'", description: '摘要欄移到頁首下方的斷點。' },
        { name: '[collapseQuery]', type: 'string', default: "'(max-width: 900px)'", description: '頁首只留第一個主要動作、其餘收進「更多」的斷點。' },
      ],
    },
    {
      title: '描述清單（lib-description-list）',
      rows: [
        { name: '[items]', type: 'DescriptionItem[]', default: '必填', description: '{ label, value, hint?, copyable?, key? }；value 是 null 或空字串時顯示 labels 的 empty。' },
        { name: '[columns]', type: '1 | 2', default: '1', description: '1：摘要欄（標籤在左）；2：概覽分頁（兩欄、標籤在上）。767px 以下一律 1 欄。' },
        { name: 'ng-template[libDescriptionValue]', type: 'string', description: '用 key（沒有 key 時用 label）對應某一列，換成自訂的值（狀態標籤、連結）；let-item 拿到整筆。' },
        { name: '(copied)', type: 'DescriptionCopiedEvent', description: '複製成功（{ item, text }）。元件只在按鈕旁顯示「已複製」，要不要 toast 由頁面決定。' },
        { name: '(copyFailed)', type: 'DescriptionItem', description: '瀏覽器不允許寫入剪貼簿。' },
      ],
    },
    {
      title: '注入',
      rows: [
        { name: 'DETAIL_LAYOUT_LABELS', type: 'DetailLayoutLabels', default: '必填', description: 'more（「更多」按鈕的無障礙名稱）、loading（骨架的報讀文字）。' },
        { name: 'DESCRIPTION_LIST_LABELS', type: 'DescriptionListLabels', default: '必填', description: 'empty、copy（{label}）、copied。少一句會在建立元件時丟錯並列出缺的名稱。' },
      ],
    },
  ];
}
