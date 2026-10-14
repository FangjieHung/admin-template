import { Injector } from '@angular/core';
import { Router } from '@angular/router';
import { CommandItem, CommandProvider, RecentCommand, createStaticCommandProvider } from '@admin-template/ui';
import { AccessService } from '@admin-template/access';
import { COLOR_THEMES, ThemeService, getDefaultThemeId, isThemeCompatible, texture } from '@admin-template/theme-pack';
import { SHOWCASE_ENTRIES, SHOWCASE_GROUPS, showcaseRoute } from '../../showcase/showcase-registry';
import { NotificationCenterService } from '../../core/notifications/notification-center.service';
import { TicketRepository } from '../../features/tickets/data/ticket.repository';
import { TICKET_ASSIGNEES } from '../../features/tickets/data/ticket-demo-data';
import { TICKET_STATUS_LABELS, Ticket } from '../../features/tickets/data/ticket.model';
import { ZH_TW_APP_COMMANDS } from '../../shared/ui/command-palette-labels';

const t = ZH_TW_APP_COMMANDS;

/**
 * 頁首全域指令面板的三組結果（跟面板一起 lazy 載入，不在 Initial bundle）：
 * - 頁面：側欄的每一頁（展示目錄＋首頁、設定、規劃中的樣板），目前身分沒有權限的不列出；
 * - 工單：依編號或標題搜尋示範資料（非同步、有網路延遲），打開 /templates/tickets/:id；
 * - 動作：新增工單、切換質地／配色／身分（兩段式子清單）、開啟通知中心。
 * 新專案把「工單」換成自己的資料（客戶、訂單…），每一種資料一個非同步來源。
 */
export function createAppCommandProviders(injector: Injector): CommandProvider[] {
  return [pagesProvider(injector), ticketsProvider(injector), actionsProvider(injector)];
}

// ---- 頁面 ----

function pagesProvider(injector: Injector): CommandProvider {
  const router = injector.get(Router);
  const access = injector.get(AccessService);
  const groupLabel = new Map(SHOWCASE_GROUPS.map((g) => [g.id, g.label]));
  const go = (route: string) => () => void router.navigateByUrl(route);
  const all: (CommandItem & { access?: Parameters<AccessService['can']>[0] })[] = [
    { id: 'home', title: t.home, icon: 'home', kind: 'page', keywords: ['/', 'home'], run: go('/') },
    ...SHOWCASE_ENTRIES.map((entry) => {
      const route = showcaseRoute(entry);
      return {
        id: entry.id,
        title: entry.title,
        subtitle: groupLabel.get(entry.group),
        icon: entry.icon,
        kind: 'page' as const,
        // 網址裡的示範紀錄編號（templates/tickets/TK-2048）不當關鍵字，否則搜工單編號會先跳出樣板頁
        keywords: [route.replace(/\/[A-Z]+-\d+/g, ''), entry.id],
        ...(entry.access ? { access: entry.access } : {}),
        run: go(route),
      };
    }),
    { id: 'planned-templates', title: t.plannedTemplates, icon: 'pending', kind: 'page', keywords: ['/templates'], run: go('/templates') },
    { id: 'settings', title: t.settings, icon: 'settings', kind: 'page', keywords: ['/settings', 'settings'], run: go('/settings') },
  ];
  return createStaticCommandProvider({
    id: 'pages',
    label: t.pages,
    limit: 6,
    // 每次搜尋都依目前身分過濾：換身分後馬上反映。
    items: () => all.filter((item) => !item.access || access.can(item.access)),
  });
}

// ---- 工單 ----

const ASSIGNEE_NAME = new Map(TICKET_ASSIGNEES.map((p) => [p.id, p.name]));

function ticketsProvider(injector: Injector): CommandProvider {
  const router = injector.get(Router);
  const access = injector.get(AccessService);
  const repository = injector.get(TicketRepository);
  const item = (id: string, title: string, subtitle?: string): CommandItem => ({
    id,
    title,
    subtitle,
    icon: 'confirmation_number',
    kind: 'record',
    keywords: [id],
    run: () => void router.navigateByUrl(`/templates/tickets/${id}`),
  });
  const subtitleOf = (ticket: Ticket) =>
    [ticket.id, TICKET_STATUS_LABELS[ticket.status], ticket.assigneeId ? ASSIGNEE_NAME.get(ticket.assigneeId) : t.unassigned].join(' · ');
  return {
    id: 'tickets',
    label: t.tickets,
    async: true,
    minQueryLength: 2,
    limit: 5,
    enabled: () => access.can('ticket:view'),
    search: async (query, signal) =>
      (await repository.search(query, { signal, limit: 5 })).map((ticket) => item(ticket.id, ticket.title, subtitleOf(ticket))),
    // 最近使用存了標題與第二行，直接換回可以打開的項目（不必再查一次）。
    resolve: (recent: RecentCommand) => (access.can('ticket:view') ? item(recent.id, recent.title, recent.subtitle) : null),
  };
}

// ---- 動作 ----

function actionsProvider(injector: Injector): CommandProvider {
  const router = injector.get(Router);
  const access = injector.get(AccessService);
  const theme = injector.get(ThemeService);
  const labelOf = (list: readonly { id: string; label: string }[], id: string) => list.find((o) => o.id === id)?.label ?? id;

  const textureItem = (id: string, label: string, inList: boolean): CommandItem => {
    const keep = isThemeCompatible(id, theme.theme());
    return {
      id: `texture:${id}`,
      title: label,
      // 子清單裡說明「切過去配色會換掉」（TEXTURE_COMPATIBILITY）；最近使用裡改成說明這是哪個動作。
      subtitle: inList ? (keep ? undefined : t.colorWillChange.replace('{color}', labelOf(COLOR_THEMES, getDefaultThemeId(id)))) : t.texture,
      icon: 'texture',
      kind: 'action',
      keywords: [id],
      current: theme.paradigm() === id,
      run: () => theme.setParadigm(id),
    };
  };
  const colorItem = (id: string, label: string, inList: boolean): CommandItem => ({
    id: `color:${id}`,
    title: label,
    ...(inList ? {} : { subtitle: t.color }),
    icon: 'palette',
    kind: 'action',
    keywords: [id],
    current: theme.theme() === id,
    run: () => theme.setTheme(id),
  });
  const identityItem = (userId: string, inList: boolean): CommandItem | null => {
    const user = access.users().find((u) => u.id === userId);
    if (!user) return null;
    const roles = user.roleIds.map((id) => access.role(id)?.name).filter(Boolean).join('、') || t.noRoles;
    return {
      id: `identity:${user.id}`,
      title: user.name,
      subtitle: inList ? roles : t.identity,
      icon: 'person',
      kind: 'action',
      keywords: [user.id],
      current: access.currentUser()?.id === user.id,
      run: () => access.signIn(user.id),
    };
  };

  const roots = (): CommandItem[] => [
    ...(access.can('ticket:create')
      ? [{ id: 'ticket-new', title: t.newTicket, subtitle: t.newTicketHint, icon: 'add_circle', kind: 'action' as const, keywords: ['new ticket', 'create'], run: () => void router.navigateByUrl('/templates/tickets/new') }]
      : []),
    {
      id: 'texture',
      title: t.texture,
      subtitle: t.currentPrefix + labelOf(texture, theme.paradigm()),
      icon: 'texture',
      kind: 'action',
      keywords: ['texture', 'theme', '外觀'],
      children: () => texture.map((o) => textureItem(o.id, o.label, true)),
    },
    {
      id: 'color',
      title: t.color,
      subtitle: t.currentPrefix + labelOf(COLOR_THEMES, theme.theme()),
      icon: 'palette',
      kind: 'action',
      keywords: ['color', 'theme', '外觀'],
      // 只列目前質地的相容配色（TEXTURE_COMPATIBILITY，ThemeService.compatibleThemes）。
      children: () => theme.compatibleThemes().map((o) => colorItem(o.id, o.label, true)),
    },
    {
      id: 'identity',
      title: t.identity,
      subtitle: t.currentPrefix + (access.currentUser()?.name ?? t.signedOut),
      icon: 'switch_account',
      kind: 'action',
      keywords: ['identity', 'user', '登入'],
      children: () => access.users().map((u) => identityItem(u.id, true)!),
    },
    {
      id: 'notifications',
      title: t.notifications,
      subtitle: t.notificationsHint,
      icon: 'notifications',
      kind: 'action',
      keywords: ['notifications', 'inbox', '通知'],
      run: () => injector.get(NotificationCenterService).toggle(true),
    },
  ];

  return createStaticCommandProvider({
    id: 'actions',
    label: t.actions,
    limit: 6,
    items: roots,
    suggestions: roots,
    // 子清單的項目（某個質地、配色、身分）也記進最近使用：用 id 換回，配色不相容目前質地時不顯示。
    resolve: (recent) => {
      const [kind, value] = recent.id.split(':');
      if (kind === 'texture') {
        const option = texture.find((o) => o.id === value);
        return option ? textureItem(option.id, option.label, false) : null;
      }
      if (kind === 'color') {
        const option = theme.compatibleThemes().find((o) => o.id === value);
        return option ? colorItem(option.id, option.label, false) : null;
      }
      if (kind === 'identity') return value ? identityItem(value, false) : null;
      return roots().find((item) => item.id === recent.id && !item.children) ?? null;
    },
  });
}
