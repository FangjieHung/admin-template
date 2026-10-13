import type { StatusKey } from '@admin-template/theme-pack';

/**
 * 工單樣板的資料型別與顯示文字（示範資料，中性）。新專案把「工單」換成自己的資料時，從這個檔案開始改：
 * 型別、狀態與標籤換掉，再改 ticket.repository.ts 的存取方式（換成 HTTP）。
 */

export type TicketStatus = 'open' | 'in-progress' | 'waiting' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketCategory = 'hardware' | 'software' | 'account' | 'network' | 'other';

export interface Ticket {
  /** 編號，也是網址上的 id，例：TK-2048。 */
  id: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  /** 負責人（TicketPerson 的 id）；還沒指派是 null。 */
  assigneeId: string | null;
  /** 申請人（TicketPerson 的 id）。 */
  requesterId: string;
  /** ISO 時間字串。 */
  createdAt: string;
  /** 期限：'YYYY-MM-DD'；沒有期限是 null。 */
  dueDate: string | null;
  description: string;
  attachmentCount: number;
}

/** 表單送出的內容（新增、編輯共用）。 */
export interface TicketDraft {
  title: string;
  category: TicketCategory;
  priority: TicketPriority;
  assigneeId: string | null;
  requesterId: string;
  dueDate: string | null;
  description: string;
}

/** 負責人與申請人（relation-select 的選項）。 */
export interface TicketPerson {
  id: string;
  name: string;
  team: string;
}

export const TICKET_STATUS_LABELS: Readonly<Record<TicketStatus, string>> = {
  open: '待處理',
  'in-progress': '處理中',
  waiting: '等待回覆',
  resolved: '已完成',
  closed: '已關閉',
};

/** 業務狀態 → 狀態語意（決定狀態標籤的色調）。 */
export const TICKET_STATUS_TONES: Readonly<Record<TicketStatus, StatusKey>> = {
  open: 'pending',
  'in-progress': 'processing',
  waiting: 'warning',
  resolved: 'completed',
  closed: 'archived',
};

export const TICKET_PRIORITY_LABELS: Readonly<Record<TicketPriority, string>> = {
  low: '低',
  medium: '中',
  high: '高',
  urgent: '緊急',
};

export const TICKET_CATEGORY_LABELS: Readonly<Record<TicketCategory, string>> = {
  hardware: '硬體設備',
  software: '軟體',
  account: '帳號與權限',
  network: '網路',
  other: '其他',
};

export const TICKET_STATUSES = Object.keys(TICKET_STATUS_LABELS) as TicketStatus[];
export const TICKET_PRIORITIES = Object.keys(TICKET_PRIORITY_LABELS) as TicketPriority[];
export const TICKET_CATEGORIES = Object.keys(TICKET_CATEGORY_LABELS) as TicketCategory[];

/** 標題長度上限（表單驗證與字數提示共用）。 */
export const TICKET_TITLE_MAX = 80;
export const TICKET_DESCRIPTION_MAX = 2000;

/** 找不到工單（網址的 id 不存在或已刪除）。 */
export class TicketNotFoundError extends Error {
  constructor(readonly ticketId: string) {
    super(`找不到工單 ${ticketId}`);
    this.name = 'TicketNotFoundError';
  }
}
