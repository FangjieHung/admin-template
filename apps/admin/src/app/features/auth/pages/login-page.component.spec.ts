import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideAccess } from '@admin-template/access';
import { DEMO_ACCESS_CONFIG } from '../../../core/access/demo-access';
import { AuthService } from '../../../core/auth/auth.service';
import { DEFAULT_USER_PREFERENCES, UserPreferencesStore } from '../../../core/user-preferences';
import { LOGIN_DEMO_DELAY, REMEMBERED_USERNAME_KEY, demoSignIn } from '../login-demo';
import { LoginPageComponent } from './login-page.component';

describe('demoSignIn（示範登入規則）', () => {
  const users = DEMO_ACCESS_CONFIG.users;

  it('示範帳號＋密碼 demo → 對應的示範身分；帳號不分大小寫、去掉前後空白', () => {
    expect(demoSignIn('manager', 'demo', users)).toEqual({ ok: true, userId: 'u-manager' });
    expect(demoSignIn('  Viewer ', 'demo', users)).toEqual({ ok: true, userId: 'u-viewer' });
  });

  it('密碼錯或帳號不存在 → invalid；帳號 locked → locked（不看密碼）', () => {
    expect(demoSignIn('manager', 'wrong', users)).toEqual({ ok: false, reason: 'invalid' });
    expect(demoSignIn('nobody', 'demo', users)).toEqual({ ok: false, reason: 'invalid' });
    expect(demoSignIn('locked', 'demo', users)).toEqual({ ok: false, reason: 'locked' });
  });
});

describe('LoginPageComponent（登入樣板）', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [LoginPageComponent],
      providers: [
        provideRouter([]),
        provideAccess(DEMO_ACCESS_CONFIG),
        { provide: AuthService, useValue: { login: vi.fn() } },
        { provide: LOGIN_DEMO_DELAY, useValue: 0 },
      ],
    });
  });

  function setup() {
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const type = (selector: string, value: string) => {
      const input = el.querySelector<HTMLInputElement>(selector);
      if (!input) throw new Error(`找不到 ${selector}`);
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    const submit = async () => {
      await fixture.componentInstance.submit();
      fixture.detectChanges();
    };
    return { fixture, el, type, submit };
  }

  it('不在殼層裡：頁面自己有唯一的 h1「登入」，以及「樣板說明」入口', () => {
    const { el } = setup();
    expect(Array.from(el.querySelectorAll('h1')).map((h) => h.textContent?.trim())).toEqual(['登入']);
    expect(el.querySelector('app-template-info')).not.toBeNull();
  });

  it('空白送出：顯示欄位錯誤、焦點在帳號欄，不呼叫登入', async () => {
    const { el, submit } = setup();
    await submit();
    expect(el.textContent).toContain('請輸入帳號');
    expect(document.activeElement).toBe(el.querySelector('input[formcontrolname="username"]'));
    expect(vi.mocked(TestBed.inject(AuthService).login)).not.toHaveBeenCalled();
  });

  it('密碼錯誤：顯示「帳號或密碼錯誤」（role=alert），清空密碼並把焦點移回密碼欄', async () => {
    const { el, type, submit } = setup();
    type('input[formcontrolname="username"]', 'manager');
    type('input[formcontrolname="password"]', 'wrong');
    await submit();

    const alert = el.querySelector('[data-login-error]');
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(alert?.textContent).toContain('帳號或密碼錯誤');
    const password = el.querySelector<HTMLInputElement>('input[formcontrolname="password"]');
    expect(password?.value).toBe('');
    expect(document.activeElement).toBe(password);
  });

  it('帳號 locked：顯示「帳號已鎖定」', async () => {
    const { el, type, submit } = setup();
    type('input[formcontrolname="username"]', 'locked');
    type('input[formcontrolname="password"]', 'demo');
    await submit();
    expect(el.querySelector('[data-login-error]')?.getAttribute('data-reason')).toBe('locked');
    expect(el.querySelector('[data-login-error]')?.textContent).toContain('帳號已鎖定');
  });

  it('點示範帳號填好表單；送出後以那個身分登入、記住帳號，並導向首頁', async () => {
    const { el, fixture, submit } = setup();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const names = Array.from(el.querySelectorAll('.login-account__meta')).map((n) => n.textContent);
    expect(names).toEqual(['系統管理員', '主管', '成員', '檢視者', '成員、檢視者']);
    expect(el.querySelector('button[data-username="member"]')?.getAttribute('title')).toBe('王小明');

    el.querySelector<HTMLButtonElement>('button[data-username="member"]')?.click();
    fixture.detectChanges();
    el.querySelector<HTMLInputElement>('mat-checkbox input')?.click();
    fixture.detectChanges();
    await submit();

    expect(vi.mocked(TestBed.inject(AuthService).login)).toHaveBeenCalledWith('u-member');
    expect(localStorage.getItem(REMEMBERED_USERNAME_KEY)).toBe('member');
    expect(navigateSpy).toHaveBeenCalledWith('/');
  });

  it('設定頁「偏好」選了預設首頁：沒有 returnUrl 時登入後打開那一頁', async () => {
    TestBed.inject(UserPreferencesStore).set({ ...DEFAULT_USER_PREFERENCES, homePage: 'templates/tickets' });
    const { el, fixture, submit } = setup();
    const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    el.querySelector<HTMLButtonElement>('button[data-username="member"]')?.click();
    fixture.detectChanges();
    await submit();
    expect(navigateSpy).toHaveBeenCalledWith('/templates/tickets');
  });

  it('顯示／隱藏密碼：切換輸入框的 type 與按鈕的 aria-pressed', () => {
    const { el, fixture } = setup();
    const toggle = el.querySelector<HTMLButtonElement>('.login-reveal');
    const password = () => el.querySelector<HTMLInputElement>('input[formcontrolname="password"]');
    expect(password()?.type).toBe('password');
    toggle?.click();
    fixture.detectChanges();
    expect(password()?.type).toBe('text');
    expect(toggle?.getAttribute('aria-pressed')).toBe('true');
  });
});
