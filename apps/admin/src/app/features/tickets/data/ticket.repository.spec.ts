import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TICKET_COUNT } from './ticket-demo-data';
import { TicketDraft, TicketNotFoundError } from './ticket.model';
import { TICKET_DEMO_TODAY, TICKET_REPOSITORY_DELAY, TicketLoadError, TicketRepository } from './ticket.repository';

const ME = { name: '你' };
const TODAY = new Date(2026, 9, 14, 15, 0);

function draftOf(overrides: Partial<TicketDraft> = {}): TicketDraft {
  return {
    title: '新的工單',
    category: 'hardware',
    priority: 'high',
    assigneeId: 'staff-01',
    requesterId: 'req-001',
    dueDate: '2026-10-20',
    description: '說明',
    ...overrides,
  };
}

describe('TicketRepository（工單樣板的示範資料層）', () => {
  let repo: TicketRepository;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: TICKET_REPOSITORY_DELAY, useValue: 0 },
        { provide: TICKET_DEMO_TODAY, useValue: () => TODAY },
      ],
    });
    repo = TestBed.inject(TicketRepository);
  });

  it('固定種子：120 張工單、編號 TK-2001…TK-2120、新到舊；每次產生的內容都一樣', async () => {
    const list = await repo.list();
    expect(list).toHaveLength(TICKET_COUNT);
    expect(list[0].id).toBe('TK-2120');
    expect(list.at(-1)?.id).toBe('TK-2001');
    expect(list.some((t) => t.id === 'TK-2048')).toBe(true);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: TICKET_REPOSITORY_DELAY, useValue: 0 },
        { provide: TICKET_DEMO_TODAY, useValue: () => TODAY },
      ],
    });
    const again = await TestBed.inject(TicketRepository).list();
    expect(again).toEqual(list);
  });

  it('list() 回傳複本：改回傳的物件不會改到資料層', async () => {
    const [first] = await repo.list();
    first.title = '被改掉';
    expect((await repo.get(first.id))?.title).not.toBe('被改掉');
  });

  it('示範開關：simulateError 丟 TicketLoadError、simulateEmpty 回空陣列', async () => {
    await expect(repo.list({ simulateError: true })).rejects.toBeInstanceOf(TicketLoadError);
    expect(await repo.list({ simulateEmpty: true })).toEqual([]);
  });

  it('找不到：get 回 null；update／assign 丟 TicketNotFoundError', async () => {
    expect(await repo.get('TK-9999')).toBeNull();
    await expect(repo.update('TK-9999', draftOf(), ME)).rejects.toBeInstanceOf(TicketNotFoundError);
    await expect(repo.assign('TK-9999', null, ME)).rejects.toBeInstanceOf(TicketNotFoundError);
  });

  it('存檔：update 改資料，活動紀錄最上面多一筆列出改了哪些欄位', async () => {
    const before = await repo.activity('TK-2048');
    const saved = await repo.update('TK-2048', draftOf({ title: '  改過的標題  ' }), ME);

    expect(saved.title).toBe('改過的標題');
    expect((await repo.get('TK-2048'))?.title).toBe('改過的標題');
    const after = await repo.activity('TK-2048');
    expect(after).toHaveLength(before.length + 1);
    expect(after[0].summary).toContain('你 修改了');
    expect(after[0].changes?.map((c) => c.field)).toContain('標題');
  });

  it('新增：create 給下一個編號、狀態待處理、排在最前面，並記一筆「建立」', async () => {
    const created = await repo.create(draftOf(), ME);
    expect(created.id).toBe('TK-2121');
    expect(created.status).toBe('open');
    expect((await repo.list())[0].id).toBe('TK-2121');
    expect((await repo.activity('TK-2121'))[0]).toMatchObject({ kind: 'create', summary: '你 建立了工單' });
  });

  it('改狀態：活動紀錄寫「你 把狀態從 A 改成 B」；restore(快照) 改回來', async () => {
    const original = await repo.get('TK-2048');
    if (!original) throw new Error('TK-2048 應該存在');
    const target = original.status === 'closed' ? 'open' : 'closed';
    const snapshot = await repo.setStatus(['TK-2048'], target, ME);

    expect((await repo.get('TK-2048'))?.status).toBe(target);
    expect((await repo.activity('TK-2048'))[0].summary).toMatch(/^你 把狀態從「.+」改成「.+」$/);

    await repo.restore(snapshot);
    expect((await repo.get('TK-2048'))?.status).toBe(original.status);
  });

  it('刪除與復原：remove 回傳快照，restore 放回原本的位置（含活動紀錄）', async () => {
    const list = await repo.list();
    const ids = [list[3].id, list[10].id];
    const activity = await repo.activity(ids[0]);
    const snapshot = await repo.remove(ids);

    expect(await repo.list()).toHaveLength(TICKET_COUNT - 2);
    expect(await repo.get(ids[0])).toBeNull();
    expect(await repo.activity(ids[0])).toEqual([]);

    await repo.restore(snapshot);
    const restored = await repo.list();
    expect(restored.map((t) => t.id)).toEqual(list.map((t) => t.id));
    expect(await repo.activity(ids[0])).toEqual(activity);
  });

  it('指派：記一筆負責人的變更；relation-select 的來源查得到負責人與新建立的申請人', async () => {
    await repo.assign('TK-2048', 'staff-02', ME);
    expect((await repo.get('TK-2048'))?.assigneeId).toBe('staff-02');
    expect((await repo.activity('TK-2048'))[0].summary).toBe('你 把工單指派給 林雅婷');

    const page = await repo.assigneeSource.search('林', new AbortController().signal);
    expect(page.items.map((p) => p.name)).toContain('林雅婷');

    const person = repo.addRequester('新同事');
    expect(await repo.requesterSource.getById(person.id)).toEqual(person);
    expect(repo.personName(person.id)).toBe('新同事');
  });
});
