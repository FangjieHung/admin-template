import { Injectable, InjectionToken, inject } from '@angular/core';
import type { ActivityChange, ActivityEntry, RelationSource } from '@admin-template/ui';
import { TICKET_ASSIGNEES, TicketDemoData, makeTicketDemoData } from './ticket-demo-data';
import {
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  Ticket,
  TicketDraft,
  TicketNotFoundError,
  TicketPerson,
  TicketStatus,
} from './ticket.model';

/**
 * 工單的資料存取層。畫面只透過這個類別讀寫，所以介面全部是非同步的：新專案換成 HTTP 時只改這一個檔案
 * （例如 `list()` 改成 `firstValueFrom(http.get<Ticket[]>('/api/tickets'))`），頁面不用動。
 *
 * 示範版本把資料放在記憶體裡（固定種子的 120 張工單），存檔、刪除會真的改資料，重新整理頁面才恢復。
 * 每個呼叫模擬 300ms 的網路延遲（測試用 TICKET_REPOSITORY_DELAY 改成 0）。
 */

/** 模擬的網路延遲（毫秒）。 */
export const TICKET_REPOSITORY_DELAY = new InjectionToken<number>('TICKET_REPOSITORY_DELAY', {
  providedIn: 'root',
  factory: () => 300,
});

/** 產生示範資料的「今天」（測試固定日期用）。 */
export const TICKET_DEMO_TODAY = new InjectionToken<() => Date>('TICKET_DEMO_TODAY', {
  providedIn: 'root',
  factory: () => () => new Date(),
});

/** 做動作的人：活動紀錄的操作者。 */
export interface TicketActor {
  name: string;
}

/** list() 的示範開關（只在示範版本有意義，接後端後拿掉）。 */
export interface TicketListOptions {
  /** 模擬載入失敗。 */
  simulateError?: boolean;
  /** 模擬「一筆資料都沒有」。 */
  simulateEmpty?: boolean;
}

/** 刪除或批次修改前的快照：交給 restore() 就回到快照當時的樣子（「復原」用）。 */
export interface TicketSnapshot {
  readonly entries: readonly { index: number; ticket: Ticket; activity: readonly ActivityEntry[] }[];
}

/** 示範的載入失敗。 */
export class TicketLoadError extends Error {
  constructor() {
    super('工單載入失敗（示範）');
    this.name = 'TicketLoadError';
  }
}

@Injectable({ providedIn: 'root' })
export class TicketRepository {
  private readonly delayMs = inject(TICKET_REPOSITORY_DELAY);
  private readonly data: TicketDemoData = makeTicketDemoData(inject(TICKET_DEMO_TODAY)());
  private createdRequesters = 0;

  /** 負責人的選項來源（relation-select）。 */
  readonly assigneeSource: RelationSource<TicketPerson> = this.personSource(() => TICKET_ASSIGNEES);
  /** 申請人的選項來源（relation-select，可以當場建立）。 */
  readonly requesterSource: RelationSource<TicketPerson> = this.personSource(() => this.data.requesters);

  // ---- 讀取 ----

  async list(options: TicketListOptions = {}): Promise<Ticket[]> {
    await this.delay();
    if (options.simulateError) throw new TicketLoadError();
    if (options.simulateEmpty) return [];
    return this.data.tickets.map((t) => ({ ...t }));
  }

  /** 找不到回 null。 */
  async get(id: string): Promise<Ticket | null> {
    await this.delay();
    const ticket = this.find(id);
    return ticket ? { ...ticket } : null;
  }

  /** 活動紀錄（新到舊）。 */
  async activity(id: string): Promise<ActivityEntry[]> {
    await this.delay();
    return [...(this.data.activity.get(id) ?? [])];
  }

  /** 名字（清單、詳情顯示用）；找不到回 id 本身。 */
  personName(id: string | null): string {
    if (!id) return '';
    return this.person(id)?.name ?? id;
  }

  person(id: string): TicketPerson | null {
    return TICKET_ASSIGNEES.find((p) => p.id === id) ?? this.data.requesters.find((p) => p.id === id) ?? null;
  }

  // ---- 寫入 ----

  async create(draft: TicketDraft, actor: TicketActor): Promise<Ticket> {
    await this.delay();
    const next = Math.max(...this.data.tickets.map((t) => Number(t.id.slice(3))), 2000) + 1;
    const ticket: Ticket = {
      id: `TK-${next}`,
      ...draft,
      title: draft.title.trim(),
      status: 'open',
      createdAt: new Date().toISOString(),
      attachmentCount: 0,
    };
    this.data.tickets.unshift(ticket);
    this.data.activity.set(ticket.id, [this.entry(ticket.id, actor, 'create', `${actor.name} 建立了工單`)]);
    return { ...ticket };
  }

  /** 存檔；活動紀錄記一筆有哪些欄位改了。id 不存在丟 TicketNotFoundError。 */
  async update(id: string, draft: TicketDraft, actor: TicketActor): Promise<Ticket> {
    await this.delay();
    const current = this.require(id);
    const next: Ticket = { ...current, ...draft, title: draft.title.trim() };
    const changes = this.diff(current, next);
    Object.assign(current, next);
    if (changes.length) {
      const fields = changes.map((c) => c.field).join('、');
      this.log(id, this.entry(id, actor, 'edit', `${actor.name} 修改了${fields}`, changes));
    }
    return { ...current };
  }

  /** 改狀態（單筆或批次）。回傳改之前的快照，給「復原」用。 */
  async setStatus(ids: readonly string[], status: TicketStatus, actor: TicketActor): Promise<TicketSnapshot> {
    await this.delay();
    const snapshot = this.snapshot(ids);
    for (const id of ids) {
      const ticket = this.require(id);
      if (ticket.status === status) continue;
      const from = TICKET_STATUS_LABELS[ticket.status];
      const to = TICKET_STATUS_LABELS[status];
      ticket.status = status;
      const kind = status === 'closed' ? 'close' : status === 'resolved' ? 'resolve' : 'status';
      this.log(id, this.entry(id, actor, kind, `${actor.name} 把狀態從「${from}」改成「${to}」`, [{ field: '狀態', from, to }]));
    }
    return snapshot;
  }

  async assign(id: string, assigneeId: string | null, actor: TicketActor): Promise<Ticket> {
    await this.delay();
    const ticket = this.require(id);
    if (ticket.assigneeId !== assigneeId) {
      const from = this.personName(ticket.assigneeId) || null;
      const to = this.personName(assigneeId) || null;
      ticket.assigneeId = assigneeId;
      const summary = to ? `${actor.name} 把工單指派給 ${to}` : `${actor.name} 取消了指派`;
      this.log(id, this.entry(id, actor, 'assign', summary, [{ field: '負責人', from, to }]));
    }
    return { ...ticket };
  }

  /** 刪除（單筆或批次）。回傳刪除前的快照，交給 restore() 就能復原。 */
  async remove(ids: readonly string[]): Promise<TicketSnapshot> {
    await this.delay();
    const snapshot = this.snapshot(ids);
    const gone = new Set(ids);
    this.data.tickets = this.data.tickets.filter((t) => !gone.has(t.id));
    for (const id of ids) this.data.activity.delete(id);
    return snapshot;
  }

  /** 回到快照當時的樣子：刪掉的放回原位，改過的改回來（含活動紀錄）。 */
  async restore(snapshot: TicketSnapshot): Promise<void> {
    await this.delay();
    // 由前往後插回原本的位置。
    for (const { index, ticket, activity } of [...snapshot.entries].sort((a, b) => a.index - b.index)) {
      const at = this.data.tickets.findIndex((t) => t.id === ticket.id);
      if (at === -1) {
        this.data.tickets.splice(Math.min(index, this.data.tickets.length), 0, { ...ticket });
      } else {
        this.data.tickets[at] = { ...ticket };
      }
      this.data.activity.set(ticket.id, [...activity]);
    }
  }

  /** relation-select 的「建立」：新增一位申請人（示範，只存在記憶體）。 */
  addRequester(name: string): TicketPerson {
    this.createdRequesters += 1;
    const person: TicketPerson = {
      id: `req-new-${this.createdRequesters}`,
      name: name.trim(),
      team: '新建立的申請人',
    };
    this.data.requesters.push(person);
    return person;
  }

  // ---- 內部 ----

  private find(id: string): Ticket | undefined {
    return this.data.tickets.find((t) => t.id === id);
  }

  private require(id: string): Ticket {
    const ticket = this.find(id);
    if (!ticket) throw new TicketNotFoundError(id);
    return ticket;
  }

  private snapshot(ids: readonly string[]): TicketSnapshot {
    return {
      entries: ids.map((id) => {
        const index = this.data.tickets.findIndex((t) => t.id === id);
        if (index === -1) throw new TicketNotFoundError(id);
        return { index, ticket: { ...this.data.tickets[index] }, activity: [...(this.data.activity.get(id) ?? [])] };
      }),
    };
  }

  private diff(before: Ticket, after: Ticket): ActivityChange[] {
    const changes: ActivityChange[] = [];
    const add = (field: string, from: string | null, to: string | null) => {
      if ((from ?? '') !== (to ?? '')) changes.push({ field, from: from || null, to: to || null });
    };
    add('標題', before.title, after.title);
    add('分類', TICKET_CATEGORY_LABELS[before.category], TICKET_CATEGORY_LABELS[after.category]);
    add('優先順序', TICKET_PRIORITY_LABELS[before.priority], TICKET_PRIORITY_LABELS[after.priority]);
    add('負責人', this.personName(before.assigneeId), this.personName(after.assigneeId));
    add('申請人', this.personName(before.requesterId), this.personName(after.requesterId));
    add('期限', before.dueDate, after.dueDate);
    if (before.description !== after.description) changes.push({ field: '描述', from: null, to: '已更新' });
    return changes;
  }

  private entry(id: string, actor: TicketActor, kind: string, summary: string, changes?: ActivityChange[]): ActivityEntry {
    const seq = (this.data.activity.get(id)?.length ?? 0) + 1;
    return {
      id: `${id}-a${seq}-${Date.now().toString(36)}`,
      actor: { name: actor.name },
      at: new Date().toISOString(),
      kind,
      summary,
      ...(changes ? { changes } : {}),
    };
  }

  private log(id: string, entry: ActivityEntry): void {
    this.data.activity.set(id, [entry, ...(this.data.activity.get(id) ?? [])]);
  }

  private personSource(list: () => readonly TicketPerson[]): RelationSource<TicketPerson> {
    return {
      idOf: (p) => p.id,
      search: async (query, signal) => {
        await this.delay(signal);
        const q = query.trim().toLocaleLowerCase();
        const matched = list().filter((p) => !q || p.name.includes(q) || p.team.toLocaleLowerCase().includes(q));
        return { items: matched.slice(0, 20), hasMore: matched.length > 20 };
      },
      getById: async (id) => list().find((p) => p.id === id) ?? null,
    };
  }

  private delay(signal?: AbortSignal): Promise<void> {
    if (this.delayMs <= 0) {
      return signal?.aborted ? Promise.reject(new DOMException('Aborted', 'AbortError')) : Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, this.delayMs);
      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });
  }
}
