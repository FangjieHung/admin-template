import { Component, Provider } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, RouterOutlet, provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { AccessService, provideAccess } from '@admin-template/access';
import { DEMO_ACCESS_CONFIG } from '../../../core/access/demo-access';
import { HeaderComponent } from '../../../layout/header/header.component';
import { TICKET_DEMO_TODAY, TICKET_REPOSITORY_DELAY, TicketRepository } from '../data/ticket.repository';
import { TICKET_ROUTES } from '../tickets.routes';

// 工單樣板的頁面測試共用：頁首（工具列插槽）＋router-outlet，路由跟正式的一樣（tickets.routes.ts）。
// 只給 *.spec.ts 用；不 import vitest，app 的 tsconfig 也編得過。

@Component({
  selector: 'app-ticket-test-host',
  imports: [RouterOutlet, HeaderComponent],
  template: `<app-header [defaultTitle]="{ title: '', breadcrumbs: [] }" /><router-outlet />`,
})
class TicketTestHostComponent {}

@Component({ template: '<p data-page="forbidden">沒有權限</p>' })
class ForbiddenStubComponent {}

export const TICKET_TEST_TODAY = new Date(2026, 9, 14, 15, 0);

/** 確認對話框（MatDialog）的回答：測試裡改這個值決定按確認還是取消；也可以給指派對話框的結果。 */
export interface DialogAnswers {
  next: unknown;
  opened: unknown[];
}

export interface TicketPageHarness {
  fixture: ComponentFixture<TicketTestHostComponent>;
  el: HTMLElement;
  router: Router;
  repo: TicketRepository;
  access: AccessService;
  dialog: DialogAnswers;
  settle(): Promise<void>;
  navigate(url: string): Promise<void>;
}

export async function setupTicketPage(extraProviders: Provider[] = []): Promise<TicketPageHarness> {
  try {
    localStorage.clear();
  } catch {
    // 測試環境沒有 localStorage 時略過
  }
  const dialog: DialogAnswers = { next: true, opened: [] };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'templates/tickets', children: TICKET_ROUTES },
        { path: 'forbidden', component: ForbiddenStubComponent },
      ]),
      provideAccess(DEMO_ACCESS_CONFIG),
      { provide: TICKET_REPOSITORY_DELAY, useValue: 0 },
      { provide: TICKET_DEMO_TODAY, useValue: () => TICKET_TEST_TODAY },
      {
        provide: MatDialog,
        useValue: {
          open: (_component: unknown, config: { data?: unknown }) => {
            dialog.opened.push(config?.data);
            return { afterClosed: () => of(dialog.next) };
          },
        },
      },
      ...extraProviders,
    ],
  });
  const fixture = TestBed.createComponent(TicketTestHostComponent);
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
    repo: TestBed.inject(TicketRepository),
    access: TestBed.inject(AccessService),
    dialog,
    settle,
    navigate: async (url: string) => {
      await router.navigateByUrl(url);
      await settle();
    },
  };
}
