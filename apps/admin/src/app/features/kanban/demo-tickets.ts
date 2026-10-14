import type { KanbanColumn } from '@admin-template/ui';

/** 看板展示頁的示範工單（中性資料）。欄位 id 對到 `status`。 */
export type KanbanTicketPriority = 'urgent' | 'high' | 'medium' | 'low';

export interface KanbanTicket {
  /** 工單編號，例：TK-2101。 */
  id: string;
  title: string;
  status: string;
  priority: KanbanTicketPriority;
  /** 負責人；還沒指派是 null。 */
  assignee: string | null;
  /** 期限 'YYYY-MM-DD'。 */
  dueDate: string;
}

export const KANBAN_PRIORITY_LABELS: Readonly<Record<KanbanTicketPriority, string>> = {
  urgent: '緊急',
  high: '高',
  medium: '中',
  low: '低',
};

/** 優先順序 → `.ui-chip--{tone}`（文字一定寫出來，不只靠顏色）。 */
export const KANBAN_PRIORITY_TONES: Readonly<Record<KanbanTicketPriority, string>> = {
  urgent: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'neutral',
};

export const KANBAN_DEMO_COLUMNS: readonly KanbanColumn[] = [
  { id: 'todo', title: '待處理', allowAdd: true },
  { id: 'doing', title: '進行中', wipLimit: 3, hint: '同時最多 3 張，超過時欄位會提醒' },
  { id: 'review', title: '待確認', hint: '等申請人確認結果' },
  { id: 'done', title: '已完成' },
];

export function kanbanDemoTickets(): KanbanTicket[] {
  return [
    { id: 'TK-2101', title: '三樓印表機卡紙，無法列印', status: 'todo', priority: 'high', assignee: null, dueDate: '2026-10-16' },
    { id: 'TK-2102', title: '新進同仁帳號開通', status: 'todo', priority: 'medium', assignee: '林雅婷', dueDate: '2026-10-17' },
    { id: 'TK-2103', title: '會議室投影機無畫面', status: 'todo', priority: 'urgent', assignee: null, dueDate: '2026-10-15' },
    { id: 'TK-2096', title: '更換門市收銀機網路線', status: 'doing', priority: 'high', assignee: '王小明', dueDate: '2026-10-15' },
    { id: 'TK-2097', title: '報表匯出出現亂碼', status: 'doing', priority: 'medium', assignee: '陳志豪', dueDate: '2026-10-18' },
    { id: 'TK-2099', title: 'VPN 連線不穩定', status: 'doing', priority: 'urgent', assignee: '王小明', dueDate: '2026-10-14' },
    { id: 'TK-2090', title: '申請第二台螢幕', status: 'review', priority: 'low', assignee: '林雅婷', dueDate: '2026-10-20' },
    { id: 'TK-2088', title: '共用信箱權限調整', status: 'review', priority: 'medium', assignee: '陳志豪', dueDate: '2026-10-19' },
    { id: 'TK-2081', title: '筆電電池更換', status: 'done', priority: 'low', assignee: '王小明', dueDate: '2026-10-10' },
  ];
}
