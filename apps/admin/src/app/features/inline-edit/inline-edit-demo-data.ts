// 表格內直接編輯展示頁的示範資料（專案任務、聯絡人、專案）。固定內容，截圖與測試可重現；新專案刪掉展示頁時一起刪。
import { DEMO_CONTACTS, DEMO_PROJECTS } from '../../showcase/demo-data';

export type DemoTaskStatus = 'todo' | 'doing' | 'review' | 'done';

export interface DemoTask {
  id: string;
  code: string;
  title: string;
  /** 負責人（DEMO_CONTACTS 的 id）。 */
  ownerId: string | null;
  status: DemoTaskStatus;
  hours: number | null;
  /** 'YYYY-MM-DD' */
  due: string | null;
  urgent: boolean;
}

export const DEMO_TASK_STATUS_LABELS: Readonly<Record<DemoTaskStatus, string>> = {
  todo: '待辦',
  doing: '進行中',
  review: '待確認',
  done: '完成',
};

export function makeDemoTasks(): DemoTask[] {
  return [
    { id: 'k1', code: 'P-101', title: '盤點現有頁面', ownerId: 'c1', status: 'done', hours: 6, due: '2026-10-09', urgent: false },
    { id: 'k2', code: 'P-102', title: '訪談三位使用者', ownerId: 'c3', status: 'doing', hours: 10, due: '2026-10-17', urgent: true },
    { id: 'k3', code: 'P-103', title: '整理需求清單', ownerId: 'c2', status: 'todo', hours: 4, due: '2026-10-20', urgent: false },
    { id: 'k4', code: 'P-104', title: '畫線框稿', ownerId: null, status: 'todo', hours: 16, due: '2026-10-24', urgent: false },
    { id: 'k5', code: 'P-105', title: '設計審查', ownerId: 'c5', status: 'review', hours: 3, due: '2026-10-27', urgent: true },
    { id: 'k6', code: 'P-106', title: '可用性測試', ownerId: 'c6', status: 'todo', hours: null, due: null, urgent: false },
  ];
}

export type DemoDept = 'sales' | 'eng' | 'support' | 'finance' | 'admin';

export interface DemoPerson {
  id: string;
  name: string;
  email: string;
  phone: string;
  dept: DemoDept;
  active: boolean;
}

export const DEMO_DEPT_LABELS: Readonly<Record<DemoDept, string>> = {
  sales: '業務部',
  eng: '工程部',
  support: '客服部',
  finance: '財務部',
  admin: '行政部',
};

const DEPT_BY_TEAM: Record<string, DemoDept> = { 業務部: 'sales', 工程部: 'eng', 客服部: 'support', 財務部: 'finance', 行政部: 'admin' };

export function makeDemoPeople(): DemoPerson[] {
  return DEMO_CONTACTS.map((c, i) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: `02-2700-${String(1100 + i * 37).padStart(4, '0')}`,
    dept: DEPT_BY_TEAM[c.team] ?? 'admin',
    active: i !== 3,
  }));
}

/** 「複製這一塊」：三列 × Email、電話、部門（第二列的 Email 故意寫錯，示範貼上時逐格檢查）。 */
export const DEMO_PASTE_BLOCK = [
  ['xiaoming.wang@example.com', '02-2700-2001', '業務部'],
  ['datong.chen＠example', '02-2700-2002', '工程部'],
  ['meihui.lin@example.com', '02-2700-2003', '研發部'],
]
  .map((cells) => cells.join('\t'))
  .join('\n');

export interface DemoProjectRow {
  id: string;
  name: string;
  owner: string;
  progress: number;
  budget: number;
  dueDate: string;
}

export function makeDemoProjects(): DemoProjectRow[] {
  return [
    ...DEMO_PROJECTS.map((p) => ({ ...p })),
    { id: 'p5', name: '內部知識庫', owner: '黃志偉', progress: 100, budget: 120000, dueDate: '2026-09-30' },
  ];
}
