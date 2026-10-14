import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnvironmentInjector, Injector } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { OverlayContainer } from '@angular/cdk/overlay';
import { AccessService, provideAccess } from '@admin-template/access';
import { ThemeService } from '@admin-template/theme-pack';
import { CommandProvider } from '@admin-template/ui';
import { DEMO_ACCESS_CONFIG } from '../../core/access/demo-access';
import { TICKET_REPOSITORY_DELAY } from '../../features/tickets/data/ticket.repository';
import { HeaderComponent } from '../header/header.component';
import { isCommandPaletteOpen, toggleCommandPalette } from './command-palette-host';
import { createAppCommandProviders } from './app-command-providers';
import { COMMAND_HISTORY_KEY } from './command-palette-dialog.component';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('全域指令面板（頁首 ⌘K 打開的 overlay）', () => {
  let fixture: ComponentFixture<HeaderComponent>;
  let overlay: HTMLElement;
  let trigger: HTMLButtonElement;

  async function settle(ms = 0): Promise<void> {
    fixture.detectChanges();
    await sleep(ms);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const dialog = () => overlay.querySelector<HTMLElement>('app-command-palette-dialog');
  const input = () => overlay.querySelector<HTMLInputElement>('app-command-palette-dialog input')!;
  const titles = () => Array.from(overlay.querySelectorAll('[lib-command-option] .co-title')).map((e) => e.textContent!.trim());
  const groups = () => Array.from(overlay.querySelectorAll('.cmdk-group__heading')).map((e) => e.textContent!.trim());

  function type(text: string): void {
    input().value = text;
    input().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = document.activeElement ?? document.body): void {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    localStorage.removeItem(COMMAND_HISTORY_KEY);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        provideAccess(DEMO_ACCESS_CONFIG),
        { provide: TICKET_REPOSITORY_DELAY, useValue: 0 },
      ],
    });
    fixture = TestBed.createComponent(HeaderComponent);
    fixture.componentRef.setInput('defaultTitle', { title: '首頁', breadcrumbs: [] });
    fixture.autoDetectChanges();
    overlay = TestBed.inject(OverlayContainer).getContainerElement();
    trigger = fixture.nativeElement.querySelector('.topbar-search');
    await settle();
  });

  afterEach(() => {
    toggleCommandPalette(TestBed.inject(EnvironmentInjector), false);
    overlay.innerHTML = '';
  });

  it('頁首的搜尋鈕：aria-haspopup、快捷鍵說明；點了打開對話框並聚焦搜尋框', async () => {
    expect(trigger.getAttribute('aria-label')).toBe('搜尋全站');
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-keyshortcuts')).toBe('Control+K /');
    expect(trigger.dataset['kbd']).toBe('Ctrl K');
    trigger.focus();
    trigger.click();
    await settle(50);
    expect(isCommandPaletteOpen()).toBe(true);
    expect(dialog()?.getAttribute('role')).toBe('dialog');
    expect(dialog()?.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(input());
    // 查詢空白：建議的動作。
    expect(groups()).toEqual(['動作']);
    expect(titles()).toContain('切換質地');
  });

  it('Ctrl+K 打開、再按一次關上，焦點回到打開前的位置；在輸入欄位裡按 / 不會打開', async () => {
    trigger.focus();
    press('k', { ctrlKey: true }, document.body);
    await settle(50);
    expect(isCommandPaletteOpen()).toBe(true);
    press('k', { ctrlKey: true });
    await settle(20);
    expect(isCommandPaletteOpen()).toBe(false);
    expect(document.activeElement).toBe(trigger);

    const field = document.createElement('input');
    document.body.append(field);
    field.focus();
    press('/', {}, field);
    await settle(20);
    expect(isCommandPaletteOpen()).toBe(false);
    field.remove();
    press('/', {}, document.body);
    await settle(50);
    expect(isCommandPaletteOpen()).toBe(true);
  });

  it('Esc：有字先清空，再按一次關閉，焦點回到搜尋鈕', async () => {
    trigger.focus();
    trigger.click();
    await settle(50);
    type('設定');
    press('Escape');
    expect(input().value).toBe('');
    expect(isCommandPaletteOpen()).toBe(true);
    press('Escape');
    await settle();
    expect(isCommandPaletteOpen()).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('輸入 TK-20：只有工單一組（樣板頁網址裡的示範編號不算關鍵字）；Enter 打開那張工單並關閉面板，記進最近使用', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl');
    trigger.click();
    await settle(50);
    type('TK-20');
    await settle(250);
    expect(groups()).toEqual(['工單']);
    const ticketRows = overlay.querySelectorAll('[data-group="tickets"] [lib-command-option]');
    expect(ticketRows.length).toBe(5);
    expect(ticketRows[0].querySelector('.co-subtitle mark')?.textContent).toBe('TK-20');
    press('ArrowDown');
    const id = (ticketRows[1] as HTMLElement).dataset['commandId'];
    press('Enter');
    await settle();
    expect(navigate).toHaveBeenCalledWith(`/templates/tickets/${id}`);
    expect(isCommandPaletteOpen()).toBe(false);
    expect(JSON.parse(localStorage.getItem(COMMAND_HISTORY_KEY)!)[0]).toMatchObject({ providerId: 'tickets', id });
    // 再打開：最近使用列在最上面。
    trigger.click();
    await settle(50);
    expect(groups()).toEqual(['最近使用', '動作']);
  });

  it('切換質地（兩段式）→ Brutal：呼叫 ThemeService.setParadigm', async () => {
    const theme = TestBed.inject(ThemeService);
    const setParadigm = vi.spyOn(theme, 'setParadigm').mockResolvedValue();
    trigger.click();
    await settle(50);
    type('質地');
    press('Enter');
    await settle();
    expect(overlay.querySelector('.cmdk-crumb')?.textContent).toContain('切換質地');
    expect(titles()).toHaveLength(13);
    type('brutal');
    expect(titles()).toEqual(['Brutal 新粗野']);
    press('Enter');
    await settle();
    expect(setParadigm).toHaveBeenCalledWith('brutal');
    expect(isCommandPaletteOpen()).toBe(false);
  });
});

describe('createAppCommandProviders（頁面、工單、動作）', () => {
  let providers: CommandProvider[];
  let access: AccessService;
  const signal = new AbortController().signal;
  const byId = (id: string) => providers.find((p) => p.id === id)!;
  const titles = async (id: string, query: string) => (await byId(id).search(query, signal)).map((i) => i.title);

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideAccess(DEMO_ACCESS_CONFIG), { provide: TICKET_REPOSITORY_DELAY, useValue: 0 }],
    });
    providers = createAppCommandProviders(TestBed.inject(Injector));
    access = TestBed.inject(AccessService);
  });

  it('頁面依目前身分過濾：主管看不到「角色與權限」，登出後工單整組停用、「新增工單」消失', async () => {
    expect(await titles('pages', '角色')).toEqual(['角色與權限']);
    access.signIn('u-manager');
    expect(await titles('pages', '角色')).toEqual([]);
    expect(await titles('actions', '新增')).toEqual(['新增工單']);
    access.signOut();
    expect(byId('tickets').enabled?.()).toBe(false);
    expect(await titles('actions', '新增')).toEqual([]);
    expect(await titles('pages', '列表頁')).toEqual([]);
  });

  it('工單：依編號或標題搜尋，編號開頭相符的在前', async () => {
    const items = await byId('tickets').search('TK-2048', signal);
    expect(items[0]).toMatchObject({ id: 'TK-2048', kind: 'record' });
    expect(items[0].subtitle).toMatch(/^TK-2048 · /);
  });

  it('切換配色只列目前質地的相容配色；目前使用中的打勾', async () => {
    const theme = TestBed.inject(ThemeService);
    const color = (await byId('actions').search('切換配色', signal))[0];
    const children = await color.children!();
    expect(children.map((c) => c.id.replace('color:', ''))).toEqual(theme.compatibleThemes().map((o) => o.id));
    expect(children.filter((c) => c.current).map((c) => c.id)).toEqual([`color:${theme.theme()}`]);
  });

  it('切換身分：列出示範帳號（目前的打勾），選了就換身分', async () => {
    const identity = (await byId('actions').search('切換身分', signal))[0];
    const users = await identity.children!();
    expect(users.find((u) => u.current)?.title).toBe('林雅婷');
    await users.find((u) => u.title === '王小明')!.run!();
    expect(access.currentUser()?.id).toBe('u-member');
  });
});
