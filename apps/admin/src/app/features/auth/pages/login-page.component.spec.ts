import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideAccess } from '@admin-template/access';
import { DEMO_ACCESS_CONFIG } from '../../../core/access/demo-access';
import { AuthService } from '../../../core/auth/auth.service';
import { ZH_TW } from '../../../core/i18n/zh-tw';
import { HeaderTitleSlot } from '../../../layout/header/header-title';
import { LoginPageComponent } from './login-page.component';

describe('LoginPageComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LoginPageComponent],
      providers: [
        provideRouter([]),
        provideAccess(DEMO_ACCESS_CONFIG),
        { provide: AuthService, useValue: { login: vi.fn() } },
      ],
    });
  });

  it('顯示登入標題', () => {
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('登入');
  });

  it('頁首標題登記為「登入」（不在側欄選單裡），頁面本身不渲染 h1', () => {
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();

    expect(TestBed.inject(HeaderTitleSlot).entry()?.value).toEqual({
      title: ZH_TW.loginPage.title,
      breadcrumbs: [],
    });
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('h1')).toHaveLength(0);
  });

  it('每個示範帳號一顆按鈕並列出角色；點擊以那個身分登入並導向首頁', () => {
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const auth = TestBed.inject(AuthService);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const buttons = Array.from(el.querySelectorAll<HTMLButtonElement>('button[data-user-id]'));
    expect(buttons.map((b) => b.querySelector('.login-account__roles')?.textContent)).toEqual([
      '系統管理員',
      '主管',
      '成員',
      '檢視者',
      '成員、檢視者',
    ]);
    (el.querySelector('button[data-user-id="u-manager"]') as HTMLButtonElement).click();

    expect(vi.mocked(auth.login)).toHaveBeenCalledWith('u-manager');
    expect(navigateSpy).toHaveBeenCalledWith('/');
  });
});
