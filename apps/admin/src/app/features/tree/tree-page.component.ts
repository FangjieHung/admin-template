import { Component, computed, signal, viewChild } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatLabel, MatHint } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatCheckbox } from '@angular/material/checkbox';
import {
  DataTableCellDirective,
  StatusChipComponent,
  TreeComponent,
  TreeExpandAllResult,
  TreeHighlightComponent,
  TreeKey,
  TreeLoadChildren,
  TreeServerSearch,
  TreeNodeDirective,
  TreeTableColumn,
  TreeTableComponent,
} from '@admin-template/ui';
import { TREE_LABEL_PROVIDERS } from '../../shared/ui/tree-labels';
import { DemoBlockComponent } from '../../showcase/demo-block.component';
import { ApiSection, ShowcasePageComponent } from '../../showcase/showcase-page.component';
import { detailOf } from '../../showcase/showcase-catalog';
import {
  CATEGORY_TREE,
  CategoryNode,
  DRIVE_CONTENTS,
  DRIVE_ROOTS,
  searchDrive,
  FOLDER_CONTENTS,
  FOLDER_FAILS_ONCE,
  FOLDER_ROOTS,
  FolderNode,
  ORG_KIND_ICONS,
  ORG_KIND_LABELS,
  ORG_TREE,
  OrgNode,
  PLAN_ROWS,
  PLAN_STATUS_LABELS,
  PlanRow,
} from './demo-tree-data';

const ENTRY = detailOf('tree');

/** 延遲載入示範的「網路」延遲。 */
const LOAD_DELAY_MS = 700;
/** 共用雲端硬碟示範：每個請求的延遲，與「全部展開」這一次最多載入幾個資料夾。 */
const DRIVE_DELAY_MS = 400;
const DRIVE_MAX_LOADS = 20;

/** 依鍵建出 鍵 → 節點、鍵 → 父節點 的對照（詳情的路徑、勾選清單的名稱用）。 */
function indexTree<T extends { id: string; children?: T[] }>(roots: readonly T[]) {
  const byId = new Map<string, T>();
  const parentOf = new Map<string, T | null>();
  const visit = (node: T, parent: T | null) => {
    byId.set(node.id, node);
    parentOf.set(node.id, parent);
    node.children?.forEach((kid) => visit(kid, node));
  };
  roots.forEach((root) => visit(root, null));
  return { byId, parentOf };
}

const ORG_INDEX = indexTree(ORG_TREE);
const CATEGORY_INDEX = indexTree(CATEGORY_TREE);

/** 樹狀選單與樹狀表展示頁（/components/tree）。 */
@Component({
  selector: 'app-tree-page',
  imports: [
    MatButton,
    MatFormField,
    MatLabel,
    MatHint,
    MatInput,
    MatCheckbox,
    TreeComponent,
    TreeNodeDirective,
    TreeHighlightComponent,
    TreeTableComponent,
    DataTableCellDirective,
    StatusChipComponent,
    ShowcasePageComponent,
    DemoBlockComponent,
  ],
  providers: [...TREE_LABEL_PROVIDERS],
  templateUrl: './tree-page.component.html',
  styleUrls: ['../../showcase/demo-shared.scss', './tree-page.component.scss'],
})
export class TreePageComponent {
  protected readonly entry = ENTRY;
  protected readonly idOf = (node: { id: string }) => node.id;
  protected readonly nameOf = (node: { name: string }) => node.name;

  // ---- (a) 組織架構：single ----
  protected readonly org = ORG_TREE;
  protected readonly orgKindLabels = ORG_KIND_LABELS;
  protected readonly orgKindIcons = ORG_KIND_ICONS;
  protected readonly orgExpanded = signal<readonly TreeKey[]>(['org-hq', 'dept-rd']);
  protected readonly orgCurrent = signal<TreeKey | null>('team-web');
  protected readonly orgDetail = computed(() => {
    const id = this.orgCurrent();
    const node = id === null ? undefined : ORG_INDEX.byId.get(String(id));
    if (!node) return null;
    const path: string[] = [];
    for (let p = ORG_INDEX.parentOf.get(node.id); p; p = ORG_INDEX.parentOf.get(p.id)) path.unshift(p.name);
    return { node, path: path.join(' / ') || '—', members: countPeople(node) };
  });

  protected orgMeta(node: OrgNode): string {
    if (node.kind === 'person') return node.role ?? '';
    return `${countPeople(node)} 人`;
  }

  // ---- (b) 文件分類：multiple＋搜尋 ----
  private readonly categoryTree = viewChild<TreeComponent<CategoryNode>>('categoryTree');
  protected readonly categories = CATEGORY_TREE;
  protected readonly categoryQuery = signal('');
  protected readonly categoryExpanded = signal<readonly TreeKey[]>(['cat-fin', 'cat-it']);
  protected readonly categoryChecked = signal<readonly TreeKey[]>(['cat-purchase', 'cat-laptop']);
  /** 勾選結果只列葉分類（父分類全勾時它的葉分類都會列出來）。 */
  protected readonly checkedLeaves = computed(() =>
    this.categoryChecked()
      .map((key) => CATEGORY_INDEX.byId.get(String(key)))
      .filter((node): node is CategoryNode => !!node && !node.children?.length),
  );
  protected readonly checkedDocs = computed(() => this.checkedLeaves().reduce((sum, node) => sum + (node.docs ?? 0), 0));

  protected onCategoryQuery(event: Event): void {
    this.categoryQuery.set((event.target as HTMLInputElement).value);
  }

  /** 搜尋框按 ↓ 直接進到樹裡（第一個看得到的節點）。 */
  protected focusCategoryTree(event: Event): void {
    event.preventDefault();
    this.categoryTree()?.focus();
  }

  protected clearChecked(): void {
    this.categoryChecked.set([]);
  }

  // ---- (c) 延遲載入 ----
  protected readonly folders = FOLDER_ROOTS;
  /** 換一個數字就重新建立樹（清掉已載入的內容，讓「設計稿」再失敗一次）。 */
  protected readonly lazyRound = signal(0);
  protected readonly lazyLog = signal<readonly string[]>([]);
  private failed = new Set<string>();
  protected readonly folderHasChildren = (node: FolderNode) => node.kind === 'folder';
  protected readonly loadFolder: TreeLoadChildren<FolderNode> = (node) =>
    new Promise<FolderNode[]>((resolve, reject) => {
      setTimeout(() => {
        if (node.id === FOLDER_FAILS_ONCE && !this.failed.has(node.id)) {
          this.failed.add(node.id);
          this.pushLazyLog(`「${node.name}」載入失敗（示範：第一次一定失敗）`);
          reject(new Error('network'));
          return;
        }
        const children = FOLDER_CONTENTS[node.id] ?? [];
        this.pushLazyLog(`「${node.name}」載入完成：${children.length} 個項目`);
        resolve(children);
      }, LOAD_DELAY_MS);
    });

  protected resetLazy(): void {
    this.failed = new Set();
    this.lazyLog.set([]);
    this.lazyRound.update((n) => n + 1);
  }

  private pushLazyLog(line: string): void {
    this.lazyLog.update((log) => [line, ...log].slice(0, 5));
  }

  // ---- (c2) 共用雲端硬碟：全部展開（逐層載入）＋伺服器端搜尋 ----
  private readonly driveTree = viewChild<TreeComponent<FolderNode>>('driveTree');
  protected readonly drive = DRIVE_ROOTS;
  protected readonly driveMaxLoads = DRIVE_MAX_LOADS;
  protected readonly driveRound = signal(0);
  protected readonly driveQuery = signal('');
  protected readonly driveServer = signal(true);
  /** 「伺服器」收到幾個請求（載入資料夾＋搜尋）。 */
  protected readonly driveRequests = signal(0);
  protected readonly driveResult = signal<TreeExpandAllResult | null>(null);
  protected readonly driveProgress = computed(() => this.driveTree()?.expandAllProgress() ?? null);
  protected readonly loadDrive: TreeLoadChildren<FolderNode> = (node) =>
    new Promise<FolderNode[]>((resolve) => {
      this.driveRequests.update((n) => n + 1);
      setTimeout(() => resolve(DRIVE_CONTENTS[node.id] ?? []), DRIVE_DELAY_MS);
    });
  private readonly searchDriveServer: TreeServerSearch = (query) =>
    new Promise((resolve) => {
      this.driveRequests.update((n) => n + 1);
      setTimeout(() => resolve(searchDrive(query)), DRIVE_DELAY_MS);
    });
  protected readonly driveSearch = computed(() => (this.driveServer() ? this.searchDriveServer : null));

  protected async expandDrive(): Promise<void> {
    this.driveResult.set(null);
    const result = await this.driveTree()?.expandAll({ maxLoads: DRIVE_MAX_LOADS });
    if (result) this.driveResult.set(result);
  }

  protected stopDrive(): void {
    this.driveTree()?.cancelExpandAll();
  }

  protected collapseDrive(): void {
    this.driveTree()?.collapseAll();
    this.driveResult.set(null);
  }

  protected resetDrive(): void {
    this.driveTree()?.cancelExpandAll();
    this.driveResult.set(null);
    this.driveQuery.set('');
    this.driveRequests.set(0);
    this.driveRound.update((n) => n + 1);
  }

  protected onDriveQuery(event: Event): void {
    this.driveQuery.set((event.target as HTMLInputElement).value);
  }

  protected focusDriveTree(event: Event): void {
    event.preventDefault();
    this.driveTree()?.focus();
  }

  // ---- (d) 樹狀表 ----
  private readonly planTable = viewChild<TreeTableComponent<PlanRow>>('planTable');
  protected readonly plans = PLAN_ROWS;
  protected readonly planExpanded = signal<readonly TreeKey[]>(['prj-site']);
  protected readonly planColumns: TreeTableColumn<PlanRow>[] = [
    { key: 'name', label: '名稱' },
    { key: 'owner', label: '負責人', width: '8rem' },
    { key: 'progress', label: '進度', width: '12rem' },
    { key: 'due', label: '期限', align: 'end', width: '7rem', value: (row) => formatDue(row.due) },
  ];

  protected statusLabel(row: PlanRow): string {
    return PLAN_STATUS_LABELS[row.status] ?? '';
  }

  protected expandAllPlans(): void {
    this.planTable()?.expandAll();
  }

  protected collapseAllPlans(): void {
    this.planTable()?.collapseAll();
  }

  protected readonly whenToUse = [
    '有上下層、而且層數不固定的資料：組織架構、商品或文件分類、資料夾。',
    '要在階層裡挑一個（目前項目）或勾一批（含「整個分類」）的情境；搜尋時保留祖先，看得出結果在哪一層。',
    '子節點很多、要用到才向伺服器拿：延遲載入，失敗時就地重試；全部展開時一層一層載入（有上限），搜尋交給伺服器找、樹照路徑展開。',
    '樹狀表：每一層都有同樣幾個欄位要對齊比較，例如專案 → 階段 → 任務的負責人、進度與期限。',
  ];
  protected readonly avoid = [
    '只有兩層、每組幾個項目：用分組清單或展開面板，比樹好掃。',
    '上百列要排序、分頁、批次處理：用資料表（lib-tree-table 不做排序、分頁、凍結欄設定與表格內編輯）。',
    '導覽整個網站：用側欄或分頁（樹是內容裡的元件，不是網站導覽）。',
  ];

  protected readonly usage = `// 頁面的 providers：畫面文字（{name}、{query} 會被換掉）
providers: [{ provide: TREE_LABELS, useValue: ZH_TW_TREE }]

// 樹狀選單：single（目前項目）、multiple（三態勾選）或 none
readonly expanded = signal<TreeKey[]>(['org-hq']);   // 受控；不綁就由元件自己記
readonly current = signal<TreeKey | null>(null);

<lib-tree
  label="組織架構"
  selection="single"
  [nodes]="org"
  [nodeKey]="idOf"
  [nodeLabel]="nameOf"
  [(expandedKeys)]="expanded"
  [(currentKey)]="current"
  (activate)="open($event)"
>
  <ng-template libTreeNode [libTreeNodeOf]="org" let-node let-query="query">
    <lib-tree-highlight [text]="node.name" [query]="query" />
  </ng-template>
</lib-tree>

// 三態勾選＋搜尋；延遲載入：loadChildren 回 Promise 或 Observable
<lib-tree selection="multiple" [filterText]="query()" [(checkedKeys)]="checked" … />
<lib-tree [loadChildren]="loadFolder" [hasChildren]="isFolder" … />

// 延遲載入的樹：全部展開逐層載入（有上限、可停止），搜尋交給伺服器
readonly search: TreeServerSearch = (query) =>
  api.searchFolders(query);   // 回傳 [{ key: 'doc-42', ancestors: ['dir-a', 'dir-b'] }, …]
<lib-tree #tree [loadChildren]="loadFolder" [filterText]="query()" [serverSearch]="search" … />
const result = await tree.expandAll({ maxLoads: 20 });   // { loaded, failed, limitReached, cancelled }
tree.expandAllProgress();   // 進行中：{ loaded, failed, pending, limitReached }
tree.cancelExpandAll();

// 樹狀表：欄位寫法同 data-table，第一欄自動縮排與展開鈕
readonly columns: TreeTableColumn<PlanRow>[] = [
  { key: 'name', label: '名稱' },
  { key: 'owner', label: '負責人' },
  { key: 'due', label: '期限', align: 'end' },
];
<lib-tree-table #table label="專案進度" [rows]="plans" [columns]="columns" [rowKey]="idOf">
  <ng-template dtCell="owner" let-row>{{ row.owner }}</ng-template>
</lib-tree-table>
<button (click)="table.expandAll()">全部展開</button>`;

  protected readonly api: ApiSection[] = [
    {
      title: 'lib-tree 輸入與雙向綁定',
      rows: [
        { name: '[nodes]', type: 'T[]', default: '必填', description: '第一層節點。' },
        { name: '[nodeKey]／[nodeLabel]', type: '(node: T) => …', default: '必填', description: '唯一鍵；名稱（沒有範本時的內容、搜尋比對、預輸入）。' },
        { name: '[nodeChildren]', type: '(node: T) => T[] | null', default: '讀 children 屬性', description: '回 null／undefined 表示還不知道（交給 loadChildren）；回空陣列表示沒有子節點。' },
        { name: '[hasChildren]', type: '(node: T) => boolean', default: 'null', description: '子節點還不知道時要不要畫展開鈕（例：資料夾才有）。不給就假設可能有。' },
        { name: '[loadChildren]', type: '(node: T) => Promise<T[]> | Observable<T[]>', default: 'null', description: '第一次展開時載入、顯示轉圈；失敗時節點下方顯示錯誤與「重試」（也可以按 →）。成功過的不會重新載入；失敗的收合再展開會重新載入。' },
        { name: 'selection', type: "'none' | 'single' | 'multiple'", default: "'none'", description: 'single：目前項目（aria-selected）；multiple：三態勾選（aria-checked）。' },
        { name: '[(expandedKeys)]', type: 'TreeKey[]', default: '[]', description: '展開中的節點。雙向綁定就是受控；不綁定時元件自己記。' },
        { name: '[(currentKey)]', type: 'TreeKey | null', default: 'null', description: 'single 的目前項目：點擊、Enter、Space 改變它。' },
        { name: '[(checkedKeys)]', type: 'TreeKey[]', default: '[]', description: 'multiple 的勾選結果：所有全勾的已知節點（含父節點，依樹的順序）。只給父節點時子孫一起算勾。' },
        { name: 'filterText', type: 'string', default: "''", description: '搜尋文字：比對 nodeLabel（不分大小寫），符合的節點與祖先保留、祖先自動展開（搜尋中不能收合），比對到的字標成 <mark>。' },
        { name: '[filter]', type: '(node: T) => boolean', default: 'null', description: '自訂搜尋條件，取代文字比對（filterText 仍用來標字）。本機比對只看得到已知的節點。' },
        { name: '[serverSearch]', type: '(query) => Promise<TreeSearchMatch[]> | Observable<…>', default: 'null', description: '伺服器端搜尋（延遲載入的樹用）：filterText 停手 250ms 後呼叫，回傳符合的 { key, ancestors }（ancestors 是從第一層到父節點的鍵）。元件照路徑一層一層載入（同時最多 3 個請求、最多 50 個），找到的節點即使名稱不含搜尋字也保留；搜尋字換了就丟掉晚到的結果。沒給時，延遲載入的樹在結果下方顯示 searchLoadedOnly。' },
        { name: 'label', type: 'string', default: "''", description: '整棵樹的無障礙名稱。' },
      ],
    },
    {
      title: 'lib-tree 輸出、方法與範本',
      rows: [
        { name: '(activate)', type: 'T', description: '點擊或 Enter（single 時 Space 也算）。multiple 時點擊是勾選，Enter 仍送出 activate。' },
        { name: 'expandAll(options?)', type: 'Promise<TreeExpandAllResult>', description: '全部展開。延遲載入的樹一層一層載入還沒載入的節點：同時最多 concurrency 個請求（預設 3）、這一次最多 maxLoads 個（預設 50），到了就停（結果的 limitReached 是 true，其餘維持收合；再呼叫一次會接著載入）。載入中的節點轉圈，失敗的節點展開並顯示錯誤與重試，不中斷其他節點。' },
        { name: 'expandAllProgress()／cancelExpandAll()', type: 'signal／void', description: '全部展開進行中的進度 { loaded, failed, pending, limitReached }（沒在跑時是 null）；停止：不再送新的請求，已送出的回來後留著但不展開。' },
        { name: 'collapseAll()', type: 'void', description: '全部收合（也會停止進行中的全部展開）。' },
        { name: 'focus(key?)', type: 'void', description: '把鍵盤焦點放進樹（例：搜尋框按 ↓）。' },
        { name: 'ng-template[libTreeNode]', type: 'TreeNodeContext<T>', description: '節點內容：let-node，另有 let-level、let-expanded、let-query。加 [libTreeNodeOf]="nodes" 讓 let-node 有型別。' },
        { name: 'lib-tree-highlight', type: '[text]、[query]', description: '把比對到的字包成 <mark>；自訂範本時用它標字。' },
        { name: '勾選規則', type: '—', description: '勾父節點＝連帶勾所有已知子孫；子孫全勾時父節點自動全勾，部分勾時半勾。還沒載入的延遲節點算一個葉節點：勾了它，載入後子節點全部算勾。' },
        { name: '鍵盤', type: '—', description: '↑↓ 移動、→ 展開或進入第一個子節點、← 收合或回到父節點、Home／End、打字跳到開頭相符的節點、Space 勾選、Enter 啟用、* 展開同一層。整棵樹只有一個 tab stop。' },
        { name: '輸入法（注音、倉頡…）', type: '—', description: '鍵盤焦點實際在一個看不見的輸入框上（aria-activedescendant 指向目前節點，報讀器念的是節點），作業系統的輸入法才會啟動。組字時那一列右側出現小框顯示注音與底線，確定後用確定的字比對開頭（打「財」跳到「財務部」）；組字中的方向鍵、Enter 留給輸入法選字。' },
      ],
    },
    {
      title: 'lib-tree-table',
      rows: [
        { name: '[rows]／[columns]／[rowKey]', type: 'T[]／TreeTableColumn<T>[]／(row) => TreeKey', default: '必填', description: '欄位寫法同 data-table：key 綁資料列的屬性（虛擬欄寫 virtual: true），value 改寫顯示文字，align: \'end\' 靠右並用等寬數字；<ng-template dtCell="key" let-row> 自訂儲存格。第一欄自動縮排與展開鈕。' },
        { name: '[rowChildren]／[hasChildren]／[loadChildren]／[(expandedKeys)]', type: '同 lib-tree', description: '展開、延遲載入、受控與非受控的規則和 lib-tree 一樣；載入失敗時那一列下面多一列錯誤與「重試」。' },
        { name: 'expandAll(options?)／cancelExpandAll()／expandAllProgress()／collapseAll()', type: '同 lib-tree', description: '全部展開（延遲載入的列逐層載入，有上限、可停止）／收合。' },
        { name: '(activate)', type: 'T', description: '點擊一列或按 Enter。' },
        { name: '鍵盤（列模式）', type: '—', description: '↑↓ 換列、→ 展開或到第一個子列、← 收合或回到父列、Home／End、Enter、*、打字跳到第一欄開頭相符的列（輸入法也可以，同 lib-tree）。只有一個 tab stop（看不見的輸入框，aria-activedescendant 指向目前的列）；儲存格範本裡不要放按鈕。' },
        { name: '外觀', type: '—', description: '表格掛 .dt-table，跟資料表吃同一組 --dt-* 變數；窄螢幕橫向捲動、第一欄固定在左側。' },
        { name: '不支援', type: '—', description: '排序、分頁、凍結欄設定、欄位選擇、勾選、表格內編輯、手機卡片版——要這些請用 lib-data-table。' },
        { name: 'TREE_LABELS', type: 'TreeLabels', default: '必填', description: '6 句必填的畫面文字（載入中、載入失敗、重試、重試提示、搜尋沒有結果、沒有資料），兩個元件共用；少一句會在建立元件時丟出錯誤。另有 3 句選填：searchLoadedOnly（延遲載入的樹沒有伺服器端搜尋時，結果下方的說明）、searching（伺服器端搜尋中）、searchFailed（伺服器端搜尋失敗）。' },
      ],
    },
  ];
}

function countPeople(node: OrgNode): number {
  if (node.kind === 'person') return 1;
  return (node.children ?? []).reduce((sum, kid) => sum + countPeople(kid), 0);
}

function formatDue(date: string): string {
  const [y, m, d] = date.split('-');
  return `${y}/${m}/${d}`;
}
