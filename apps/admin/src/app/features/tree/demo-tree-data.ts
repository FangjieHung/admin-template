import type { StatusKey } from '@admin-template/theme-pack';

// 樹狀選單與樹狀表展示頁的示範資料（中性：組織、文件分類、共用資料夾、專案）。
// id 一律用「類別縮寫＋連字號＋英文單字」，不用「單一字母＋連字號＋數字」：Tailwind 會把那種字串當成 utility 編進主樣式。

// ---- (a) 組織架構：公司 → 部門 → 小組 → 人 ----

export type OrgKind = 'company' | 'department' | 'team' | 'person';

export interface OrgNode {
  id: string;
  name: string;
  kind: OrgKind;
  /** 人：職稱；部門與小組：負責人。 */
  role?: string;
  /** 人：分機。 */
  ext?: string;
  children?: OrgNode[];
}

const person = (id: string, name: string, role: string, ext: string): OrgNode => ({ id, name, kind: 'person', role, ext });

export const ORG_TREE: OrgNode[] = [
  {
    id: 'org-hq',
    name: '總公司',
    kind: 'company',
    role: '總經理 林怡君',
    children: [
      {
        id: 'dept-rd',
        name: '研發部',
        kind: 'department',
        role: '經理 王建宏',
        children: [
          {
            id: 'team-web',
            name: '前端組',
            kind: 'team',
            role: '組長 陳雅婷',
            children: [person('ppl-chen', '陳雅婷', '前端組長', '2101'), person('ppl-chang', '張志明', '前端工程師', '2102')],
          },
          {
            id: 'team-api',
            name: '後端組',
            kind: 'team',
            role: '組長 李佩珊',
            children: [person('ppl-li', '李佩珊', '後端組長', '2201'), person('ppl-huang', '黃俊傑', '後端工程師', '2202')],
          },
        ],
      },
      {
        id: 'dept-ops',
        name: '營運部',
        kind: 'department',
        role: '經理 吳淑芬',
        children: [
          {
            id: 'team-care',
            name: '客服組',
            kind: 'team',
            role: '組長 劉家豪',
            children: [person('ppl-liu', '劉家豪', '客服組長', '3101'), person('ppl-tsai', '蔡宜蓁', '客服專員', '3102')],
          },
          {
            id: 'team-admin',
            name: '行政組',
            kind: 'team',
            role: '組長 鄭雅文',
            children: [person('ppl-cheng', '鄭雅文', '行政組長', '3201')],
          },
        ],
      },
      {
        id: 'dept-fin',
        name: '財務部',
        kind: 'department',
        role: '經理 許文彥',
        children: [
          {
            id: 'team-acct',
            name: '會計組',
            kind: 'team',
            role: '組長 許文彥',
            children: [person('ppl-hsu', '許文彥', '會計組長', '4101'), person('ppl-yang', '楊淑惠', '會計專員', '4102')],
          },
        ],
      },
    ],
  },
];

export const ORG_KIND_LABELS: Readonly<Record<OrgKind, string>> = {
  company: '公司',
  department: '部門',
  team: '小組',
  person: '人員',
};

export const ORG_KIND_ICONS: Readonly<Record<OrgKind, string>> = {
  company: 'domain',
  department: 'corporate_fare',
  team: 'groups',
  person: 'person',
};

// ---- (b) 文件分類：三態勾選＋搜尋 ----

export interface CategoryNode {
  id: string;
  name: string;
  /** 葉分類的文件數。 */
  docs?: number;
  children?: CategoryNode[];
}

export const CATEGORY_TREE: CategoryNode[] = [
  {
    id: 'cat-hr',
    name: '人事',
    children: [
      { id: 'cat-hiring', name: '招募公告', docs: 12 },
      { id: 'cat-leave', name: '請假規章', docs: 4 },
      { id: 'cat-review', name: '績效考核', docs: 7 },
    ],
  },
  {
    id: 'cat-fin',
    name: '財務',
    children: [
      { id: 'cat-claim', name: '報帳流程', docs: 9 },
      { id: 'cat-purchase', name: '採購單據', docs: 31 },
      { id: 'cat-budget', name: '年度預算', docs: 3 },
    ],
  },
  {
    id: 'cat-it',
    name: '資訊',
    children: [
      { id: 'cat-account', name: '帳號申請', docs: 18 },
      {
        id: 'cat-device',
        name: '設備',
        children: [
          { id: 'cat-laptop', name: '筆電借用', docs: 6 },
          { id: 'cat-printer', name: '印表機維修', docs: 11 },
        ],
      },
      { id: 'cat-security', name: '資安守則', docs: 5 },
    ],
  },
  {
    id: 'cat-office',
    name: '行政',
    children: [
      { id: 'cat-room', name: '會議室借用', docs: 8 },
      { id: 'cat-supply', name: '文具採購', docs: 14 },
    ],
  },
];

// ---- (c) 延遲載入：共用資料夾 ----

export interface FolderNode {
  id: string;
  name: string;
  kind: 'folder' | 'file';
}

/** 每個資料夾「伺服器上」的內容（示範用，loadChildren 延遲一下再回傳）。 */
export const FOLDER_CONTENTS: Readonly<Record<string, FolderNode[]>> = {
  'dir-projects': [
    { id: 'dir-specs', name: '需求規格', kind: 'folder' },
    { id: 'doc-schedule', name: '時程表.xlsx', kind: 'file' },
    { id: 'doc-kickoff', name: '開案簡報.pdf', kind: 'file' },
  ],
  'dir-specs': [
    { id: 'doc-spec-v1', name: '規格書 v1.docx', kind: 'file' },
    { id: 'doc-spec-v2', name: '規格書 v2.docx', kind: 'file' },
  ],
  'dir-design': [
    { id: 'doc-home', name: '首頁.fig', kind: 'file' },
    { id: 'doc-icons', name: '圖示.fig', kind: 'file' },
  ],
  'dir-minutes': [],
};

export const FOLDER_ROOTS: FolderNode[] = [
  { id: 'dir-projects', name: '專案文件', kind: 'folder' },
  { id: 'dir-design', name: '設計稿', kind: 'folder' },
  { id: 'dir-minutes', name: '會議紀錄', kind: 'folder' },
  { id: 'doc-guide', name: '使用說明.pdf', kind: 'file' },
  { id: 'doc-readme', name: 'README.md', kind: 'file' },
];

/** 第一次展開「設計稿」時故意失敗，示範錯誤與重試。 */
export const FOLDER_FAILS_ONCE = 'dir-design';

// ---- (c2) 共用雲端硬碟：全部展開（逐層載入）與伺服器端搜尋 ----

/** 部門 → 年度 → 季 → 檔案（每個資料夾都要向「伺服器」拿內容）。 */
export const DRIVE_ROOTS: FolderNode[] = [
  { id: 'drv-sales', name: '業務部', kind: 'folder' },
  { id: 'drv-finance', name: '財務部', kind: 'folder' },
  { id: 'drv-rd', name: '研發部', kind: 'folder' },
  { id: 'drv-hr', name: '人資部', kind: 'folder' },
];

const DRIVE_FILES: Readonly<Record<string, readonly string[]>> = {
  'drv-sales': ['業績報表', '客戶拜訪紀錄'],
  'drv-finance': ['損益報表', '費用明細'],
  'drv-rd': ['版本說明', '測試報告'],
  'drv-hr': ['招募進度', '教育訓練名單'],
};

const YEARS = ['2024', '2025'];
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

/** 「伺服器上」每個資料夾的內容（id → 子項目）。 */
export const DRIVE_CONTENTS: Readonly<Record<string, FolderNode[]>> = (() => {
  const map: Record<string, FolderNode[]> = {};
  for (const dept of DRIVE_ROOTS) {
    map[dept.id] = [
      ...YEARS.map((y) => ({ id: `${dept.id}-${y}`, name: `${y} 年`, kind: 'folder' as const })),
      { id: `${dept.id}-readme`, name: `${dept.name}說明.pdf`, kind: 'file' },
    ];
    for (const y of YEARS) {
      map[`${dept.id}-${y}`] = QUARTERS.map((q) => ({ id: `${dept.id}-${y}-${q}`, name: `${y} ${q}`, kind: 'folder' as const }));
      for (const q of QUARTERS) {
        map[`${dept.id}-${y}-${q}`] = DRIVE_FILES[dept.id].map((file, i) => ({
          id: `${dept.id}-${y}-${q}-f${i}`,
          name: `${y}${q} ${file}.xlsx`,
          kind: 'file' as const,
        }));
      }
    }
  }
  return map;
})();

/** 伺服器端搜尋（示範）：在「伺服器上」所有項目的名稱裡找，回傳符合的鍵與祖先路徑，最多 limit 筆。 */
export function searchDrive(query: string, limit = 12): { key: string; ancestors: string[] }[] {
  const q = query.trim().toLocaleLowerCase();
  const hits: { key: string; ancestors: string[] }[] = [];
  if (!q) return hits;
  const visit = (nodes: readonly FolderNode[], ancestors: string[]) => {
    for (const node of nodes) {
      if (hits.length >= limit) return;
      if (node.name.toLocaleLowerCase().includes(q)) hits.push({ key: node.id, ancestors });
      const kids = DRIVE_CONTENTS[node.id];
      if (kids) visit(kids, [...ancestors, node.id]);
    }
  };
  visit(DRIVE_ROOTS, []);
  return hits;
}

// ---- (d) 樹狀表：專案 → 階段 → 任務 ----

export interface PlanRow {
  id: string;
  name: string;
  kind: 'project' | 'phase' | 'task';
  owner: string;
  /** 0–100。 */
  progress: number;
  status: StatusKey;
  /** YYYY-MM-DD。 */
  due: string;
  children?: PlanRow[];
}

const task = (id: string, name: string, owner: string, progress: number, due: string): PlanRow => ({
  id,
  name,
  kind: 'task',
  owner,
  progress,
  status: progress >= 100 ? 'completed' : progress > 0 ? 'processing' : 'draft',
  due,
});

export const PLAN_ROWS: PlanRow[] = [
  {
    id: 'prj-site',
    name: '官網改版',
    kind: 'project',
    owner: '陳雅婷',
    progress: 55,
    status: 'processing',
    due: '2026-12-18',
    children: [
      {
        id: 'ph-site-research',
        name: '需求訪談',
        kind: 'phase',
        owner: '陳雅婷',
        progress: 100,
        status: 'completed',
        due: '2026-10-09',
        children: [
          task('tsk-interview', '使用者訪談', '陳雅婷', 100, '2026-10-02'),
          task('tsk-report', '訪談報告', '張志明', 100, '2026-10-09'),
        ],
      },
      {
        id: 'ph-site-design',
        name: '視覺設計',
        kind: 'phase',
        owner: '張志明',
        progress: 60,
        status: 'processing',
        due: '2026-11-06',
        children: [
          task('tsk-wire', '線框稿', '張志明', 100, '2026-10-16'),
          task('tsk-visual', '視覺稿', '張志明', 40, '2026-10-30'),
          task('tsk-handoff', '設計交付', '陳雅婷', 0, '2026-11-06'),
        ],
      },
      {
        id: 'ph-site-build',
        name: '開發上線',
        kind: 'phase',
        owner: '李佩珊',
        progress: 5,
        status: 'processing',
        due: '2026-12-18',
        children: [
          task('tsk-api', '內容 API', '李佩珊', 15, '2026-11-20'),
          task('tsk-launch', '上線切換', '黃俊傑', 0, '2026-12-18'),
        ],
      },
    ],
  },
  {
    id: 'prj-ledger',
    name: '帳務系統整併',
    kind: 'project',
    owner: '許文彥',
    progress: 20,
    status: 'warning',
    due: '2027-01-29',
    children: [
      {
        id: 'ph-ledger-plan',
        name: '盤點與規劃',
        kind: 'phase',
        owner: '許文彥',
        progress: 70,
        status: 'warning',
        due: '2026-10-23',
        children: [
          task('tsk-inventory', '科目盤點', '楊淑惠', 100, '2026-10-12'),
          task('tsk-mapping', '欄位對照表', '許文彥', 40, '2026-10-23'),
        ],
      },
      {
        id: 'ph-ledger-move',
        name: '資料轉換',
        kind: 'phase',
        owner: '黃俊傑',
        progress: 0,
        status: 'draft',
        due: '2027-01-29',
        children: [task('tsk-script', '轉換程式', '黃俊傑', 0, '2026-12-11'), task('tsk-verify', '對帳驗證', '楊淑惠', 0, '2027-01-29')],
      },
    ],
  },
  {
    id: 'prj-desk',
    name: '服務台流程優化',
    kind: 'project',
    owner: '劉家豪',
    progress: 100,
    status: 'completed',
    due: '2026-09-30',
    children: [task('tsk-survey', '滿意度調查', '蔡宜蓁', 100, '2026-09-12'), task('tsk-macro', '回覆範本整理', '劉家豪', 100, '2026-09-30')],
  },
];

export const PLAN_STATUS_LABELS: Partial<Record<StatusKey, string>> = {
  completed: '已完成',
  processing: '進行中',
  draft: '未開始',
  warning: '落後',
};
