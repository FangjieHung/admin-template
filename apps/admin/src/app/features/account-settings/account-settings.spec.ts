import { afterEach, describe, expect, it } from 'vitest';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, RouterOutlet, provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { OverlayContainer } from '@angular/cdk/overlay';
import { of } from 'rxjs';
import { HeaderComponent } from '../../layout/header/header.component';
import { BlankPageComponent } from '../blank-page/blank-page.component';
import { ACCOUNT_SETTINGS_ROUTES } from './account-settings.routes';
import { ACCOUNT_SETTINGS_DELAY, AccountSettingsRepository } from './data/account-settings.repository';
import { checkPasswordRules, passwordStrength } from './sections/password-rules';
import { ProfileSectionComponent, avatarInitials } from './sections/profile-section.component';

@Component({
  selector: 'app-settings-test-host',
  imports: [RouterOutlet, HeaderComponent],
  template: `<app-header [defaultTitle]="{ title: '', breadcrumbs: [] }" /><router-outlet />`,
})
class SettingsTestHostComponent {}

@Component({ template: '<p data-page="elsewhere">別頁</p>' })
class ElsewhereComponent {}

interface DialogCall {
  title?: string;
  message: string;
  confirmLabel?: string;
  tone?: string;
  typeToConfirm?: { text: string; label: string };
}

interface Harness {
  fixture: ComponentFixture<SettingsTestHostComponent>;
  el: HTMLElement;
  router: Router;
  repo: AccountSettingsRepository;
  dialog: { next: boolean; opened: DialogCall[] };
  settle(): Promise<void>;
  navigate(url: string): Promise<void>;
}

async function setup(): Promise<Harness> {
  const dialog = { next: true, opened: [] as DialogCall[] };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'templates/settings', children: ACCOUNT_SETTINGS_ROUTES },
        { path: 'templates/blank', component: BlankPageComponent },
        { path: 'elsewhere', component: ElsewhereComponent },
      ]),
      { provide: ACCOUNT_SETTINGS_DELAY, useValue: 0 },
      {
        provide: MatDialog,
        useValue: {
          open: (_component: unknown, config: { data: DialogCall }) => {
            dialog.opened.push(config.data);
            return { afterClosed: () => of(dialog.next) };
          },
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(SettingsTestHostComponent);
  const router = TestBed.inject(Router);
  const settle = async () => {
    for (let i = 0; i < 6; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((r) => setTimeout(r));
    }
    fixture.detectChanges();
  };
  fixture.detectChanges();
  return {
    fixture,
    el: fixture.nativeElement as HTMLElement,
    router,
    repo: TestBed.inject(AccountSettingsRepository),
    dialog,
    settle,
    navigate: async (url: string) => {
      await router.navigateByUrl(url);
      await settle();
    },
  };
}

function type(el: HTMLElement, selector: string, value: string): void {
  const input = el.querySelector<HTMLInputElement>(selector);
  if (!input) throw new Error(`找不到 ${selector}`);
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function click(el: HTMLElement, selector: string): void {
  const target = el.querySelector<HTMLElement>(selector);
  if (!target) throw new Error(`找不到 ${selector}`);
  target.click();
}

function toastText(): string {
  return document.querySelector('.cdk-overlay-container')?.textContent ?? '';
}

function cell(el: HTMLElement, key: string): HTMLInputElement {
  const input = el.querySelector<HTMLInputElement>(`[data-cell="${key}"]`);
  if (!input) throw new Error(`找不到 ${key}`);
  return input;
}

afterEach(() => {
  TestBed.inject(OverlayContainer).getContainerElement().innerHTML = '';
});

describe('密碼規則（password-rules.ts）', () => {
  it('規則逐條判斷；強度只是提示', () => {
    const met = (next: string, current = '') =>
      Object.fromEntries(checkPasswordRules(next, current).map((r) => [r.id, r.met]));
    expect(met('abc')).toEqual({ length: false, letter: true, digit: false, different: true });
    expect(met('abcd1234')).toEqual({ length: true, letter: true, digit: true, different: true });
    expect(met('abcd1234', 'abcd1234')['different']).toBe(false);
    expect(met('')['different']).toBe(false);
    expect(passwordStrength('')).toBeNull();
    expect(passwordStrength('abc')).toBe('weak');
    expect(passwordStrength('abcd1234')).toBe('fair');
    expect(passwordStrength('Abcd1234!xyz')).toBe('strong');
  });
});

describe('頭像縮寫（avatarInitials）', () => {
  it('中文取第一段的最後兩個字；英文取前兩個單字的字首', () => {
    expect(avatarInitials('林雅婷')).toBe('雅婷');
    expect(avatarInitials('林雅婷（設計組）')).toBe('雅婷');
    expect(avatarInitials('林雅婷 Lin')).toBe('雅婷');
    expect(avatarInitials('Ada Lovelace')).toBe('AL');
    expect(avatarInitials('  ')).toBe('?');
  });
});

describe('設定頁樣板（/templates/settings）', () => {
  it('分組寫在網址上：/templates/settings 導到個人資料；直接開某一組（重新整理）會還原；目前項目有 aria-current', async () => {
    const h = await setup();
    await h.navigate('/templates/settings');
    expect(h.router.url).toBe('/templates/settings/profile');
    expect(h.el.querySelector('app-header h1')?.textContent).toBe('設定');
    expect(h.el.querySelector('[data-section="profile"]')?.getAttribute('aria-current')).toBe('page');
    expect(h.el.querySelector('[data-section="security"]')?.getAttribute('aria-current')).toBeNull();

    await h.navigate('/templates/settings/security');
    expect(h.el.querySelector('app-security-section')).not.toBeNull();
    expect(h.el.querySelector('[data-section="security"]')?.getAttribute('aria-current')).toBe('page');
    expect(h.el.querySelector('[data-section="security"]')?.classList).toContain('is-active');
    expect(h.el.querySelector('[data-section="profile"]')?.getAttribute('aria-current')).toBeNull();

    // 打錯的分組回到第一組。
    await h.navigate('/templates/settings/nope');
    expect(h.router.url).toBe('/templates/settings/profile');
  });

  it('明確存檔：改名稱 → 未儲存列出現 → 切換分組被提醒（選「繼續編輯」留下）→ 儲存 → 提示、列消失，之後切換不再提醒', async () => {
    const h = await setup();
    await h.navigate('/templates/settings/profile');
    expect(h.el.querySelector('[data-unsaved-bar]')).toBeNull();
    const nameInput = h.el.querySelector<HTMLInputElement>('[data-field="displayName"] input');
    expect(nameInput?.value).toBe('林雅婷');

    type(h.el, '[data-field="displayName"] input', '林雅婷 Lin');
    await h.settle();
    expect(h.el.querySelector('[data-unsaved-bar]')?.textContent).toContain('有未儲存的變更');
    expect(h.el.querySelector('.profile-avatar__badge')?.textContent?.trim()).toBe('雅婷');

    h.dialog.next = false;
    click(h.el, '[data-section="notifications"]');
    await h.settle();
    expect(h.dialog.opened).toHaveLength(1);
    expect(h.dialog.opened[0].title).toBe('有尚未儲存的變更');
    expect(h.router.url).toBe('/templates/settings/profile');
    expect(h.el.querySelector<HTMLInputElement>('[data-field="displayName"] input')?.value).toBe('林雅婷 Lin');

    click(h.el, '[data-unsaved-bar] [data-action="save"]');
    await h.settle();
    expect((await h.repo.profile()).displayName).toBe('林雅婷 Lin');
    expect(toastText()).toContain('已儲存個人資料');
    expect(h.el.querySelector('[data-unsaved-bar]')).toBeNull();

    click(h.el, '[data-section="notifications"]');
    await h.settle();
    expect(h.dialog.opened).toHaveLength(1);
    expect(h.router.url).toBe('/templates/settings/notifications');
  });

  it('dirty 判斷：改回原值就不算未存；「捨棄」回到上次存檔的值；選「捨棄變更」可以離開', async () => {
    const h = await setup();
    await h.navigate('/templates/settings/profile');
    const section = h.fixture.debugElement.query(By.directive(ProfileSectionComponent)).componentInstance as ProfileSectionComponent;
    expect(section.isDirty()).toBe(false);
    expect(await section.canLeave()).toBe(true);

    type(h.el, '[data-field="jobTitle"] input', '設計師');
    await h.settle();
    expect(section.isDirty()).toBe(true);
    type(h.el, '[data-field="jobTitle"] input', '專案經理');
    await h.settle();
    expect(section.isDirty()).toBe(false);

    type(h.el, '[data-field="jobTitle"] input', '設計師');
    await h.settle();
    click(h.el, '[data-unsaved-bar] [data-action="discard"]');
    await h.settle();
    expect(h.el.querySelector<HTMLInputElement>('[data-field="jobTitle"] input')?.value).toBe('專案經理');
    expect(h.el.querySelector('[data-unsaved-bar]')).toBeNull();

    // 重新整理或關閉分頁：有未存的變更時讓瀏覽器提示。
    type(h.el, '[data-field="jobTitle"] input', '設計師');
    await h.settle();
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);

    h.dialog.next = true;
    await h.navigate('/elsewhere');
    expect(h.router.url).toBe('/elsewhere');
    expect((await h.repo.profile()).jobTitle).toBe('專案經理');
  });

  it('驗證：顯示名稱必填、Email 格式；送出時聚焦第一個錯誤欄位並顯示 mat-error', async () => {
    const h = await setup();
    await h.navigate('/templates/settings/profile');
    const email = h.el.querySelector<HTMLInputElement>('[data-field="email"] input');
    expect(email?.readOnly).toBe(true);
    click(h.el, '[data-action="change-email"]');
    await h.settle();
    expect(email?.readOnly).toBe(false);
    expect(document.activeElement).toBe(email);

    type(h.el, '[data-field="email"] input', 'not-an-email');
    await h.settle();
    click(h.el, '[data-unsaved-bar] [data-action="save"]');
    await h.settle();
    expect(document.activeElement).toBe(email);
    expect(h.el.querySelector('[data-field="email"] mat-error')?.textContent).toContain('請輸入正確的 Email');

    type(h.el, '[data-field="displayName"] input', '');
    await h.settle();
    click(h.el, '[data-unsaved-bar] [data-action="save"]');
    await h.settle();
    expect(document.activeElement).toBe(h.el.querySelector('[data-field="displayName"] input'));
    expect(h.el.querySelector('[data-field="displayName"] mat-error')?.textContent).toContain('請輸入顯示名稱');
    expect((await h.repo.profile()).email).toBe('yating.lin@example.com');
  });

  it('即時儲存：勾了就存並提示「已更新」；「每日摘要 × Email」第一次失敗 → 勾選還原、提示錯誤，再試一次就成功', async () => {
    const h = await setup();
    await h.navigate('/templates/settings/notifications');
    expect(h.el.querySelector('[data-unsaved-bar]')).toBeNull();

    expect(cell(h.el, 'commented.email').checked).toBe(false);
    cell(h.el, 'commented.email').click();
    await h.settle();
    expect((await h.repo.notifications()).matrix.commented.email).toBe(true);
    expect(cell(h.el, 'commented.email').checked).toBe(true);
    expect(toastText()).toContain('已更新');

    expect(cell(h.el, 'daily-digest.email').checked).toBe(true);
    cell(h.el, 'daily-digest.email').click();
    await h.settle();
    expect(cell(h.el, 'daily-digest.email').checked).toBe(true);
    expect((await h.repo.notifications()).matrix['daily-digest'].email).toBe(true);
    expect(toastText()).toContain('已還原');

    cell(h.el, 'daily-digest.email').click();
    await h.settle();
    expect(cell(h.el, 'daily-digest.email').checked).toBe(false);
    expect((await h.repo.notifications()).matrix['daily-digest'].email).toBe(false);
  });

  it('即時儲存：網址帶 ?demo=fail 時每次都失敗並還原（通知、兩步驟驗證）', async () => {
    const h = await setup();
    await h.navigate('/templates/settings/notifications?demo=fail');
    cell(h.el, 'assigned.in-app').click();
    await h.settle();
    expect(cell(h.el, 'assigned.in-app').checked).toBe(true);
    expect((await h.repo.notifications()).matrix.assigned['in-app']).toBe(true);

    // 切換分組保留 ?demo=fail。
    click(h.el, '[data-section="security"]');
    await h.settle();
    expect(h.router.url).toBe('/templates/settings/security?demo=fail');
    const twoFactor = () => h.el.querySelector<HTMLButtonElement>('[data-action="two-factor"] button[role="switch"]');
    expect(twoFactor()?.getAttribute('aria-checked')).toBe('false');
    twoFactor()?.click();
    await h.settle();
    expect(twoFactor()?.getAttribute('aria-checked')).toBe('false');
    expect((await h.repo.security()).twoFactor).toBe(false);
    expect(toastText()).toContain('無法更新兩步驟驗證');
  });

  it('全部暫停：開啟後所有勾選框停用並顯示說明，個別設定保留；關閉後恢復', async () => {
    const h = await setup();
    await h.navigate('/templates/settings/notifications');
    const boxes = () => Array.from(h.el.querySelectorAll<HTMLInputElement>('[data-cell]'));
    expect(boxes()).toHaveLength(8);
    expect(boxes().every((b) => !b.disabled)).toBe(true);
    const before = boxes().map((b) => b.checked);

    click(h.el, '[data-action="pause"] button[role="switch"]');
    await h.settle();
    expect((await h.repo.notifications()).paused).toBe(true);
    expect(boxes().every((b) => b.disabled)).toBe(true);
    expect(boxes().map((b) => b.checked)).toEqual(before);
    expect(h.el.querySelector('[data-pause-hint]')?.textContent).toContain('已暫停所有通知');
    expect(toastText()).toContain('已更新');

    click(h.el, '[data-action="pause"] button[role="switch"]');
    await h.settle();
    expect(boxes().every((b) => !b.disabled)).toBe(true);
  });

  it('變更密碼：規則清單即時打勾；確認密碼不一致 → 聚焦確認欄位；目前密碼錯誤 → 聚焦目前密碼；成功後清空', async () => {
    const h = await setup();
    await h.navigate('/templates/settings/security');
    const met = () =>
      Object.fromEntries(
        Array.from(h.el.querySelectorAll('[data-rule]')).map((li) => [li.getAttribute('data-rule'), li.getAttribute('data-met')]),
      );
    expect(met()).toEqual({ length: 'false', letter: 'false', digit: 'false', different: 'false' });

    type(h.el, '[data-field="current"] input', 'old-pass-1');
    type(h.el, '[data-field="next"] input', 'abc');
    await h.settle();
    expect(met()).toEqual({ length: 'false', letter: 'true', digit: 'false', different: 'true' });
    expect(h.el.querySelector('.password-strength__value')?.textContent).toContain('弱');
    expect(h.el.querySelector('[data-unsaved-bar]')).not.toBeNull();

    type(h.el, '[data-field="next"] input', 'Abcd1234!xyz');
    type(h.el, '[data-field="confirm"] input', 'Abcd1234');
    await h.settle();
    expect(Object.values(met()).every((v) => v === 'true')).toBe(true);
    expect(h.el.querySelector('.password-strength__value')?.textContent).toContain('強');

    click(h.el, '[data-unsaved-bar] [data-action="save"]');
    await h.settle();
    expect(document.activeElement).toBe(h.el.querySelector('[data-field="confirm"] input'));
    expect(h.el.querySelector('[data-field="confirm"] mat-error')?.textContent).toContain('兩次輸入的新密碼不一樣');

    type(h.el, '[data-field="confirm"] input', 'Abcd1234!xyz');
    type(h.el, '[data-field="current"] input', 'wrong-password');
    await h.settle();
    click(h.el, '[data-unsaved-bar] [data-action="save"]');
    await h.settle();
    expect(document.activeElement).toBe(h.el.querySelector('[data-field="current"] input'));
    expect(h.el.querySelector('[data-field="current"] mat-error')?.textContent).toContain('目前的密碼不正確');

    type(h.el, '[data-field="current"] input', 'old-pass-1');
    await h.settle();
    click(h.el, '[data-unsaved-bar] [data-action="save"]');
    await h.settle();
    expect(toastText()).toContain('已變更密碼');
    expect(h.el.querySelector<HTMLInputElement>('[data-field="next"] input')?.value).toBe('');
    expect(h.el.querySelector('[data-unsaved-bar]')).toBeNull();
  });

  it('登入中的裝置：「登出這台」先確認；目前這台不能登出', async () => {
    const h = await setup();
    await h.navigate('/templates/settings/security');
    expect(h.el.querySelectorAll('[data-session]')).toHaveLength(3);
    expect(h.el.querySelector('[data-session="s-1"] [data-action="sign-out"]')).toBeNull();

    h.dialog.next = false;
    click(h.el, '[data-session="s-2"] [data-action="sign-out"]');
    await h.settle();
    expect(h.dialog.opened.at(-1)?.title).toBe('登出這台裝置？');
    expect(h.el.querySelectorAll('[data-session]')).toHaveLength(3);

    h.dialog.next = true;
    click(h.el, '[data-session="s-2"] [data-action="sign-out"]');
    await h.settle();
    expect(h.el.querySelector('[data-session="s-2"]')).toBeNull();
    expect(toastText()).toContain('已登出');
  });

  it('偏好：改每頁筆數 → 未儲存列 → 儲存', async () => {
    const h = await setup();
    await h.navigate('/templates/settings/preferences');
    const radio = h.el.querySelectorAll<HTMLInputElement>('[data-field="pageSize"] input[type="radio"]');
    expect(radio).toHaveLength(3);
    radio[2].click();
    await h.settle();
    expect(h.el.querySelector('[data-unsaved-bar]')).not.toBeNull();
    click(h.el, '[data-unsaved-bar] [data-action="save"]');
    await h.settle();
    expect((await h.repo.preferences()).pageSize).toBe(100);
    expect(toastText()).toContain('已儲存偏好設定');
  });

  it('刪除帳號：確認對話框用危險色，要求輸入帳號的 Email 才能按（輸入框的行為見 confirm-dialog 的測試）', async () => {
    const h = await setup();
    await h.navigate('/templates/settings/advanced');
    h.dialog.next = false;
    click(h.el, '[data-action="delete-account"]');
    await h.settle();
    const call = h.dialog.opened.at(-1);
    expect(call?.tone ?? 'danger').toBe('danger');
    expect(call?.confirmLabel).toBe('刪除帳號');
    expect(call?.typeToConfirm?.text).toBe('yating.lin@example.com');

    click(h.el, '[data-action="export"]');
    await h.settle();
    expect(toastText()).toContain('匯出');
  });
});

describe('空白頁樣板（/templates/blank）', () => {
  it('頁首標題「新頁面」、一張卡片寫著四個步驟與程式碼片段', async () => {
    const h = await setup();
    await h.navigate('/templates/blank');
    expect(h.el.querySelector('app-header h1')?.textContent).toBe('新頁面');
    expect(h.el.querySelectorAll('.ui-card')).toHaveLength(1);
    expect(h.el.querySelectorAll('.blank__steps > li')).toHaveLength(4);
    expect(h.el.querySelectorAll('pre')).toHaveLength(3);
    expect(h.el.querySelector('pre')?.textContent).toContain("path: 'my-page'");
  });
});
