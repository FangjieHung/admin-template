import { Component, HostListener, Injector, computed, inject, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import type { HasUnsavedChanges } from '@admin-template/access';
import {
  DataTableBatchSaveFn,
  DataTableCellChange,
  DataTableCellDirective,
  DataTableCellSaveFn,
  DataTableColumn,
  DataTableComponent,
  ToastService,
  createArraySource,
  openConfirmDialog,
} from '@admin-template/ui';
import { CONFIRM_DIALOG_LABEL_PROVIDERS, TOAST_PROVIDERS } from '../../shared/ui/component-label-providers';
import { ADMIN_EDITABLE_TABLE_LABELS } from '../../shared/ui/data-table-editing-labels';
import { RELATION_SELECT_LABEL_PROVIDERS } from '../../shared/ui/relation-select-labels';
import { DEMO_CONTACTS, DEMO_OWNERS, DemoContact } from '../../showcase/demo-data';
import { DemoBlockComponent } from '../../showcase/demo-block.component';
import { ApiSection, ShowcasePageComponent } from '../../showcase/showcase-page.component';
import { detailOf } from '../../showcase/showcase-catalog';
import {
  DEMO_DEPT_LABELS,
  DEMO_PASTE_BLOCK,
  DEMO_TASK_STATUS_LABELS,
  DemoPerson,
  DemoProjectRow,
  DemoTask,
  makeDemoPeople,
  makeDemoProjects,
  makeDemoTasks,
} from './inline-edit-demo-data';

const ENTRY = detailOf('inline-edit');

/** 示範的「伺服器」延遲。 */
const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function options<T extends string>(labels: Readonly<Record<T, string>>) {
  return (Object.entries(labels) as [T, string][]).map(([value, label]) => ({ value, label }));
}

/** 表格內直接編輯展示頁（/components/inline-edit）。 */
@Component({
  selector: 'app-inline-edit-page',
  imports: [MatButtonModule, DataTableComponent, DataTableCellDirective, ShowcasePageComponent, DemoBlockComponent],
  providers: [...TOAST_PROVIDERS, ...RELATION_SELECT_LABEL_PROVIDERS, ...CONFIRM_DIALOG_LABEL_PROVIDERS],
  templateUrl: './inline-edit-page.component.html',
  styleUrls: ['../../showcase/demo-shared.scss', './inline-edit-page.component.scss'],
})
export class InlineEditPageComponent implements HasUnsavedChanges {
  protected readonly entry = ENTRY;
  protected readonly labels = ADMIN_EDITABLE_TABLE_LABELS;
  protected readonly pasteBlock = DEMO_PASTE_BLOCK;
  private readonly toast = inject(ToastService);
  private readonly injector = inject(Injector);
  private readonly peopleTable = viewChild<DataTableComponent<DemoPerson>>('peopleTable');

  /** 示範的延遲（測試改成 0）。 */
  delayMs = 450;

  // ---- 1. 即時儲存：專案任務 ----

  protected readonly tasks = signal<readonly DemoTask[]>(makeDemoTasks());
  protected readonly lastSave = signal('（尚未儲存）');
  private readonly contactSource = createArraySource<DemoContact>(DEMO_CONTACTS, {
    idOf: (c) => c.id,
    textOf: (c) => c.name,
    secondaryOf: (c) => c.team,
  });

  protected readonly taskColumns: DataTableColumn<DemoTask>[] = [
    { key: 'code', label: '編號', primary: true, frozen: true },
    {
      key: 'title',
      label: '任務',
      primary: true,
      editor: { type: 'text', required: true, validate: (v) => (String(v).length > 30 ? '最多 30 個字' : null) },
    },
    {
      key: 'owner',
      virtual: true,
      label: '負責人',
      value: (r) => this.contactName(r.ownerId),
      sortValue: (r) => this.contactName(r.ownerId),
      editor: {
        type: 'relation',
        field: 'ownerId',
        source: this.contactSource as never,
        displayWith: (c) => (c as DemoContact).name,
        secondaryWith: (c) => (c as DemoContact).team,
      },
    },
    {
      key: 'status',
      label: '狀態',
      primary: true,
      editor: { type: 'select', required: true, options: options(DEMO_TASK_STATUS_LABELS) },
    },
    {
      key: 'hours',
      label: '工時',
      align: 'end',
      editor: {
        type: 'number',
        validate: (v) => (typeof v === 'number' && (v < 0 || v > 80) ? '請填 0 到 80' : null),
      },
    },
    { key: 'due', label: '期限', editor: { type: 'date' } },
    { key: 'urgent', label: '急件', editor: { type: 'toggle' } },
  ];

  /** 即時儲存：工時填 13 時「伺服器」拒絕（示範失敗、還原與重試）。 */
  protected readonly saveTask: DataTableCellSaveFn<DemoTask> = async (row, key, value, signal) => {
    await wait(this.delayMs, signal);
    if (key === 'hours' && value === 13) throw '伺服器拒絕了 13 小時（示範）';
    const next = { ...row, [key]: value } as DemoTask;
    this.tasks.update((list) => list.map((t) => (t.id === row.id ? { ...t, [key]: value } : t)));
    this.lastSave.set(`${row.code} 的 ${key} → ${value === null || value === '' ? '（空白）' : String(value)}`);
    return next;
  };

  // ---- 2. 批次修改與貼上：聯絡人 ----

  protected readonly people = signal<readonly DemoPerson[]>(makeDemoPeople());
  protected readonly peopleDirty = signal(false);
  protected readonly lastBatch = signal('（尚未儲存）');
  protected readonly copied = signal(false);

  protected readonly peopleColumns: DataTableColumn<DemoPerson>[] = [
    { key: 'name', label: '姓名', primary: true, frozen: true, editor: { type: 'text', required: true } },
    {
      key: 'email',
      label: 'Email',
      primary: true,
      editor: { type: 'text', required: true, validate: (v) => (EMAIL.test(String(v)) ? null : 'Email 格式不正確') },
    },
    {
      key: 'phone',
      label: '電話',
      editor: { type: 'text', validate: (v) => (!v || /^[\d\-+() ]{6,}$/.test(String(v)) ? null : '只能有數字、空白與 -') },
    },
    { key: 'dept', label: '部門', editor: { type: 'select', required: true, options: options(DEMO_DEPT_LABELS) } },
    { key: 'active', label: '啟用', editor: { type: 'toggle' } },
  ];

  protected readonly savePeople: DataTableBatchSaveFn<DemoPerson> = async (changes) => {
    await wait(this.delayMs);
    const byId = new Map<string, Partial<DemoPerson>>();
    for (const c of changes) byId.set(c.row.id, { ...byId.get(c.row.id), [c.key]: c.value });
    this.people.update((list) => list.map((p) => (byId.has(p.id) ? { ...p, ...byId.get(p.id) } : p)));
    this.lastBatch.set(describeBatch(changes));
  };

  protected async copyBlock(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.pasteBlock);
      this.copied.set(true);
      this.toast.info('已複製，點第一列的 Email 格，再按 ⌘V 或 Ctrl+V');
    } catch {
      this.toast.warning('瀏覽器不允許寫入剪貼簿，請自己選取文字複製');
    }
  }

  // ---- 3. 每一列的權限：已結案的專案鎖定 ----

  protected readonly projects = signal<readonly DemoProjectRow[]>(makeDemoProjects());
  protected readonly projectColumns: DataTableColumn<DemoProjectRow>[] = [
    { key: 'name', label: '專案', primary: true, frozen: true },
    {
      key: 'owner',
      label: '負責人',
      editor: { type: 'select', options: DEMO_OWNERS.map((o) => ({ value: o, label: o })), canEdit: (r) => r.progress < 100 },
    },
    {
      key: 'progress',
      label: '進度（%）',
      align: 'end',
      editor: {
        type: 'number',
        required: true,
        canEdit: (r) => r.progress < 100,
        validate: (v) => (typeof v === 'number' && (v < 0 || v > 100) ? '請填 0 到 100' : null),
      },
    },
    {
      key: 'budget',
      label: '預算',
      align: 'end',
      exportValue: (r) => r.budget,
      editor: { type: 'number', required: true, canEdit: (r) => r.progress < 100 },
    },
    { key: 'dueDate', label: '期限', editor: { type: 'date', required: true, canEdit: (r) => r.progress < 100 } },
    { key: 'lock', virtual: true, label: '狀態', value: (r) => (r.progress >= 100 ? '已結案，鎖定' : '進行中'), sortable: false },
  ];

  protected readonly saveProject: DataTableCellSaveFn<DemoProjectRow> = async (row, key, value, signal) => {
    await wait(this.delayMs, signal);
    this.projects.update((list) => list.map((p) => (p.id === row.id ? { ...p, [key]: value } : p)));
  };

  // ---- 4. 手機卡片版：同一份聯絡人（即時儲存） ----

  protected readonly mobilePeople = signal<readonly DemoPerson[]>(makeDemoPeople().slice(0, 3));
  protected readonly mobileColumns = computed(() => this.peopleColumns.filter((c) => c.key !== 'phone'));
  protected readonly saveMobile: DataTableCellSaveFn<DemoPerson> = async (row, key, value, signal) => {
    await wait(this.delayMs, signal);
    this.mobilePeople.update((list) => list.map((p) => (p.id === row.id ? { ...p, [key]: value } : p)));
  };

  // ---- 範本用 ----

  protected contactName(id: string | null): string {
    return DEMO_CONTACTS.find((c) => c.id === id)?.name ?? '';
  }

  protected budgetText(value: number): string {
    return value.toLocaleString('zh-TW');
  }

  protected asTask(row: unknown): DemoTask {
    return row as DemoTask;
  }

  protected asProject(row: unknown): DemoProjectRow {
    return row as DemoProjectRow;
  }

  protected statusLabel(row: DemoTask): string {
    return DEMO_TASK_STATUS_LABELS[row.status] ?? String(row.status);
  }

  // ---- 未儲存的批次修改 ----

  /** 離開頁面前（unsavedChangesGuard）：批次示範有未儲存的格子時先問。 */
  async canLeave(): Promise<boolean> {
    const table = this.peopleTable();
    if (!table?.dirty()) return true;
    const discard = await openConfirmDialog(this.injector, {
      title: '有尚未儲存的修改',
      message: '聯絡人表格裡改過的格子還沒儲存，離開的話會捨棄。',
      confirmLabel: '捨棄修改',
      cancelLabel: '繼續編輯',
    });
    if (discard) table.discardChanges();
    return discard;
  }

  /** 表格自己也會在有未儲存的批次修改時擋重新整理；這裡示範頁面層的寫法（兩者擇一即可）。 */
  @HostListener('window:beforeunload', ['$event'])
  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.peopleTable()?.dirty()) event.preventDefault();
  }

  protected readonly whenToUse = [
    '清單裡的少數欄位常常要改（狀態、負責人、數量、期限），一筆一筆打開表單太慢。',
    '要一次調整很多筆，或從 Excel／Google 試算表整理好之後貼進來（批次修改）。',
    '使用者熟悉試算表的操作：方向鍵移動、Enter 開始與確定、Esc 取消。',
  ];
  protected readonly avoid = [
    '欄位很多、彼此有連動或需要說明文字：用表單（工單表單樣板）。',
    '改了就會觸發重大後果（付款、寄信、權限）：用表單加確認對話框，不要在格子裡一鍵生效。',
    '資料大多數人只看不改：一般資料表就好，不要把每一格都變成可以點的編輯器。',
  ];

  protected readonly usage = `// 頁面的 providers：提示訊息（儲存成功的「復原」、失敗的「重試」）與關聯欄的 relation-select 文字
providers: [provideToast({ close: '關閉' }), { provide: RELATION_SELECT_LABELS, useValue: … }]

// 欄位層級開啟：只有給了 editor 的欄位可以改，其他欄位照舊唯讀
readonly columns: DataTableColumn<Task>[] = [
  { key: 'code', label: '編號', frozen: true },
  { key: 'title', label: '任務', editor: { type: 'text', required: true } },
  { key: 'status', label: '狀態', editor: { type: 'select', options: [{ value: 'todo', label: '待辦' }, …] } },
  { key: 'hours', label: '工時', align: 'end', editor: { type: 'number', validate: (v) => (v > 80 ? '請填 0 到 80' : null) } },
  { key: 'due', label: '期限', editor: { type: 'date', canEdit: (row) => !row.locked } },   // 每一列決定能不能改
  { key: 'urgent', label: '急件', editor: { type: 'toggle' } },
  // 虛擬欄顯示名字、改的是 id：用 field 指明屬性
  { key: 'owner', virtual: true, label: '負責人', value: (r) => nameOf(r.ownerId),
    editor: { type: 'relation', field: 'ownerId', source: contactSource, displayWith: (c) => c.name } },
];

<!-- 即時儲存：改一格存一格 -->
<lib-data-table [columns]="columns" [rows]="tasks()" [labels]="labels" editMode="instant" [onCellSave]="saveTask" />

// 存好就 resolve（可回傳存好的那一列）；reject 一個字串時那句話顯示在格子裡
readonly saveTask: DataTableCellSaveFn<Task> = async (row, key, value, signal) => {
  const saved = await this.api.patchTask(row.id, { [key]: value }, signal);
  this.tasks.update((list) => list.map((t) => (t.id === saved.id ? saved : t)));
  return saved;
};

<!-- 批次修改：先標成已修改，按「儲存全部」一次送出；可以從 Excel 貼上一整塊 -->
<lib-data-table #table [columns]="columns" [rows]="people()" [labels]="labels"
  editMode="batch" [onBatchSave]="savePeople" (dirtyChange)="dirty.set($event)" />

readonly savePeople: DataTableBatchSaveFn<Person> = async (changes) => {
  await this.api.patchPeople(changes.map((c) => ({ id: c.row.id, [c.key]: c.value })));
  this.people.set(await this.api.listPeople());
};

// 離開前確認（路由加 canDeactivate: [unsavedChangesGuard]）
async canLeave() {
  if (!this.table().dirty()) return true;
  const discard = await openConfirmDialog(this.injector, { title: '有尚未儲存的修改', … });
  if (discard) this.table().discardChanges();
  return discard;
}`;

  protected readonly api: ApiSection[] = [
    {
      title: 'DataTableColumn 的 editor',
      rows: [
        { name: 'type', type: "'text' | 'number' | 'select' | 'date' | 'relation' | 'toggle'", default: '必填', description: '編輯器種類。數字去掉千分位、日期是 YYYY-MM-DD（也接受 2026/1/5）、開關按空白鍵切換。' },
        { name: 'options', type: 'DataTableEditorOption[]', default: "select 必填", description: '下拉選項 { value, label }；沒有 dtCell 時格子顯示選項文字，貼上時比對 label 或 value。' },
        { name: 'source／displayWith／secondaryWith', type: 'RelationSource', default: 'relation 必填', description: '關聯欄用 relation-select（同一個資料來源介面）；值是 idOf(item)，貼上時用名稱找。' },
        { name: 'field', type: 'keyof T', default: '虛擬欄必填', description: '虛擬欄（顯示名字、存 id）要指明改的是哪個屬性。' },
        { name: 'required', type: 'boolean', default: 'false', description: '不能是空的。' },
        { name: 'validate(value, row)', type: 'string | null', description: '回傳錯誤訊息。即時儲存時有錯就留在編輯狀態；批次修改時標成錯誤、擋下「儲存全部」。' },
        { name: 'canEdit(row)', type: 'boolean', description: '這一列能不能改（鎖定、沒有權限）；不能改的格子 aria-readonly，沒有鉛筆提示。' },
        { name: 'parse(text)／format(value)', type: 'function', description: '自訂文字與值的轉換；parse 丟出的 Error 訊息就是這一格的錯誤。' },
      ],
    },
    {
      title: 'lib-data-table 的編輯輸入、輸出與方法',
      rows: [
        { name: '[editMode]', type: "'instant' | 'batch'", default: "'instant'", description: 'instant：改一格存一格；batch：先標成已修改，按「儲存全部」才送出，可以貼上一整塊。' },
        { name: '[onCellSave]', type: '(row, key, value, signal) => Promise<void | T>', default: 'instant 必填', description: '存好 resolve；失敗 reject（字串會顯示在格子裡），表格還原並提示「重試」；成功後提示「復原」5 秒。同一格又改時上一次的 signal 會 abort。' },
        { name: '[onBatchSave]', type: '(changes) => Promise<void>', default: 'batch 必填', description: 'changes 是 { row, key, value, previous }[]；reject 時修改保留並提示重試。' },
        { name: '(dirtyChange)', type: 'boolean', description: '批次修改有沒有未儲存的格子。' },
        { name: 'dirty()／saveChanges()／discardChanges()', type: 'signal／method', description: '頁面的 canDeactivate 與「儲存並離開」用（viewChild 取得資料表）。重新整理或關閉分頁時，表格有未儲存的批次修改會自己請瀏覽器確認。' },
        { name: 'labels.editing', type: 'DataTableEditingLabels', default: '有 editor 時必填', description: '所有畫面文字（{column}、{row}、{count}、{text} 會被代換）；少了會在建立表格時丟出錯誤。' },
      ],
    },
    {
      title: '鍵盤（開啟編輯時表格是 role="grid"）',
      rows: [
        { name: '方向鍵／Home／End／Ctrl+Home', type: '移動', description: '移動目前的格子（只有一格在 Tab 順序裡）；PageUp／PageDown 一次 10 列。' },
        { name: 'Enter／F2／雙擊／直接打字', type: '開始編輯', description: '打字時那個字取代原本的內容；在不能改的格子按 Enter 會念「這一格不能修改」。' },
        { name: 'Enter／Shift+Enter', type: '確定', description: '存檔並往下／往上一列。' },
        { name: 'Tab／Shift+Tab', type: '確定', description: '存檔並往右／往左（列尾換到下一列）。' },
        { name: 'Esc', type: '取消', description: '還原並回到格子。' },
        { name: '空白鍵', type: '開關', description: '切換開關欄；勾選欄照常勾選。' },
        { name: 'Delete', type: '清除', description: '批次修改時清空這一格；即時儲存時打開空白的編輯器讓你確認。' },
        { name: '⌘V／Ctrl+V', type: '貼上', description: '批次修改時，把從 Excel 複製的一塊（Tab、換行分隔）往右往下填進去，每格都檢查；不能改的格子略過。' },
      ],
    },
  ];
}

function describeBatch(changes: readonly DataTableCellChange<DemoPerson>[]): string {
  const rows = new Set(changes.map((c) => c.row.id)).size;
  return `${rows} 位聯絡人、${changes.length} 格`;
}
