import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AccessService, provideAccess } from '@admin-template/access';
import { DEMO_ACCESS_CONFIG } from '../access/demo-access';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [AuthService, provideRouter([]), provideAccess(DEMO_ACCESS_CONFIG)] });
  });

  it('login 換成選的示範帳號並建立本地 session', () => {
    const service = TestBed.inject(AuthService);

    service.login('u-viewer');

    expect(TestBed.inject(AccessService).currentUser()?.name).toBe('張美玲');
    expect(JSON.parse(localStorage.getItem('app.auth.session') ?? 'null')).toEqual({ user: 'u-viewer' });
  });

  it('logout 登出身分、清除 session 並導向登入頁', () => {
    localStorage.setItem('app.auth.session', JSON.stringify({ user: 'u-admin' }));
    const service = TestBed.inject(AuthService);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    service.logout();

    expect(TestBed.inject(AccessService).currentUser()).toBeNull();
    expect(localStorage.getItem('app.auth.session')).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith('/login');
  });
});
