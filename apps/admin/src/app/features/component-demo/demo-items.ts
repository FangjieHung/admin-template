// 示範用的中性假資料（與租車業務無關）：只給 /dev/data-table 示範頁用，刪掉示範頁時一起刪。

export type DemoStatus = 'todo' | 'doing' | 'done' | 'hold';
export type DemoCategory = 'purchase' | 'repair' | 'admin' | 'support';

export interface DemoItem {
  id: string;
  code: string;
  title: string;
  category: DemoCategory;
  status: DemoStatus;
  owner: string;
  /** ISO 字串。 */
  createdAt: string;
  dueAt: string;
  amount: number;
  qty: number;
  note: string;
}

export const DEMO_STATUS_LABELS: Record<DemoStatus, string> = {
  todo: '待處理',
  doing: '進行中',
  done: '已完成',
  hold: '暫停',
};

export const DEMO_CATEGORY_LABELS: Record<DemoCategory, string> = {
  purchase: '採購',
  repair: '維修',
  admin: '行政',
  support: '客服',
};

export const DEMO_OWNERS = ['王小明', '陳大同', '林美惠', '張家豪', '李佩君'];

const NOTES = ['', '需主管確認', '等待廠商回覆', '', '已電話聯絡', '', '下週追蹤'];
const SUBJECTS = ['辦公用品', '冷氣保養', '合約續約', '客訴回覆', '設備盤點', '網路異常', '教育訓練', '印表機維修'];

/** 固定種子的亂數：每次產生的資料都一樣（截圖與測試可重現）。 */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** 以 today 為基準產生 count 筆；到期日分布在前 5 天到後 14 天，讓「今天」「本週」都篩得到資料。 */
export function makeDemoItems(count = 312, today = new Date()): DemoItem[] {
  const rand = seeded(20261013);
  const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const at = (days: number, hour: number) =>
    new Date(base.getFullYear(), base.getMonth(), base.getDate() + days, hour).toISOString();
  const statuses: DemoStatus[] = ['todo', 'doing', 'done', 'hold'];
  const categories: DemoCategory[] = ['purchase', 'repair', 'admin', 'support'];
  return Array.from({ length: count }, (_, i) => {
    const category = pick(categories);
    return {
      id: `d${i + 1}`,
      code: `W-${String(i + 1).padStart(4, '0')}`,
      title: `${pick(SUBJECTS)} ${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26) + 1}`,
      category,
      status: pick(statuses),
      owner: pick(DEMO_OWNERS),
      createdAt: at(-Math.floor(rand() * 60) - 1, 9 + Math.floor(rand() * 8)),
      dueAt: at(Math.floor(rand() * 20) - 5, 9 + Math.floor(rand() * 9)),
      amount: Math.round(rand() * 480 + 2) * 50,
      qty: Math.floor(rand() * 40) + 1,
      note: pick(NOTES),
    };
  });
}
