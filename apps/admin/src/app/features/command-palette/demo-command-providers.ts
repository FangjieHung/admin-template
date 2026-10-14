import { CommandItem, CommandProvider, createStaticCommandProvider, filterCommands } from '@admin-template/ui';
import { DEMO_CONTACTS, DEMO_PROJECTS } from '../../showcase/demo-data';

/** 展示頁的示範來源（聯絡人、專案、動作）。`log` 收到被執行的項目名稱（示範不導覽）。 */

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

export function contactsProvider(log: (text: string) => void): CommandProvider {
  const items: CommandItem[] = DEMO_CONTACTS.map((c) => ({
    id: c.id,
    title: c.name,
    subtitle: `${c.team} · ${c.email}`,
    icon: 'person',
    kind: 'record',
    run: () => log(`打開聯絡人「${c.name}」`),
  }));
  return createStaticCommandProvider({ id: 'contacts', label: '聯絡人', items: () => items });
}

/** 非同步的專案搜尋：模擬伺服器延遲（`latencyMs`），換字時取消上一次。 */
export function projectsProvider(log: (text: string) => void, latencyMs = 400, label = '專案'): CommandProvider {
  const items: CommandItem[] = DEMO_PROJECTS.map((p) => ({
    id: p.id,
    title: p.name,
    subtitle: `負責人 ${p.owner} · 進度 ${p.progress}%`,
    icon: 'folder',
    kind: 'record',
    run: () => log(`打開專案「${p.name}」`),
  }));
  return {
    id: `projects-${latencyMs}`,
    label,
    async: true,
    search: async (query, signal) => {
      await wait(latencyMs, signal);
      return filterCommands(query, items);
    },
    resolve: (recent) => items.find((item) => item.id === recent.id) ?? null,
  };
}

/** 一定失敗的非同步來源：示範「只有這一組顯示錯誤，其他組照常」。 */
export function failingProvider(): CommandProvider {
  return {
    id: 'archive',
    label: '封存資料',
    async: true,
    search: async (_query, signal) => {
      await wait(600, signal);
      throw new Error('示範：封存資料的伺服器沒有回應');
    },
  };
}

export function demoActionsProvider(log: (text: string) => void): CommandProvider {
  let view = 'list';
  const views = [
    { id: 'list', title: '清單', icon: 'view_list' },
    { id: 'cards', title: '卡片', icon: 'grid_view' },
    { id: 'board', title: '看板', icon: 'view_kanban' },
  ];
  const roots = (): CommandItem[] => [
    { id: 'new-contact', title: '新增聯絡人', icon: 'person_add', kind: 'action', shortcut: 'N', run: () => log('新增聯絡人') },
    { id: 'export', title: '匯出聯絡人名單', subtitle: 'Excel', icon: 'download', kind: 'action', keywords: ['excel', 'xlsx'], run: () => log('匯出聯絡人名單') },
    {
      id: 'view',
      title: '切換檢視',
      subtitle: `目前：${views.find((v) => v.id === view)?.title}`,
      icon: 'view_quilt',
      kind: 'action',
      children: () =>
        views.map((v) => ({
          id: `view:${v.id}`,
          title: v.title,
          icon: v.icon,
          kind: 'action' as const,
          current: v.id === view,
          run: () => {
            view = v.id;
            log(`切換成「${v.title}」檢視`);
          },
        })),
    },
  ];
  return createStaticCommandProvider({ id: 'demo-actions', label: '動作', items: roots, suggestions: roots });
}
