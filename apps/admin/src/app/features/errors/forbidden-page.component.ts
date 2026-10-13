import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { AccessService, parsePermission } from '@admin-template/access';
import { provideHeaderTitle } from '../../layout/header/header-title';
import { ErrorPageComponent } from './error-page.component';

/**
 * 沒有權限：accessGuard 導過來（網址列維持原本的網址）。說明需要什麼權限、目前是誰，
 * 並提供「回首頁」；換成有權限的身分時會自動回到原本那一頁（rerunGuardsOnAccessChange）。
 */
@Component({
  selector: 'app-forbidden-page',
  imports: [ErrorPageComponent, RouterLink, MatButtonModule],
  template: `
    <app-error-page
      icon="lock"
      code="403"
      heading="沒有權限"
      message="你目前的身分不能開啟這一頁。如果需要，請聯絡系統管理員調整角色。"
    >
      <dl class="forbidden__facts">
        @if (needed().length) {
          <div>
            <dt>需要的權限</dt>
            <dd>{{ needed().join('、') }}</dd>
          </div>
        }
        <div>
          <dt>目前身分</dt>
          <dd>{{ identity() }}</dd>
        </div>
      </dl>
      <a errorPageSecondary matButton="outlined" routerLink="/login">換個帳號登入</a>
    </app-error-page>
  `,
  styles: `
    .forbidden__facts {
      display: grid;
      gap: 0.5rem;
      margin: 0.75rem 0 0;
      font-size: 0.875rem;

      div {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 0.25rem 0.5rem;
      }

      dt {
        color: var(--mat-sys-on-surface-variant);
      }

      dd {
        margin: 0;
        font-weight: 600;
        color: var(--mat-sys-on-surface);
      }
    }
  `,
})
export class ForbiddenPageComponent {
  private readonly access = inject(AccessService);
  private readonly params = toSignal(inject(ActivatedRoute).queryParamMap);

  /** `?need=report:view,settings:view` → 「報表・檢視」「設定・檢視」。 */
  protected readonly needed = computed(() =>
    (this.params()?.get('need') ?? '')
      .split(',')
      .map((p) => parsePermission(p))
      .filter((r) => r !== null)
      .map((r) => {
        const feature = this.access.features.find((f) => f.id === r.feature)?.label ?? r.feature;
        return `${feature}・${this.access.labels.actions[r.action]}`;
      }),
  );

  protected readonly identity = computed(() => {
    const user = this.access.currentUser();
    if (!user) return '未登入';
    const roles = this.access.currentRoles().map((r) => r.name).join('、') || '沒有角色';
    return `${user.name}（${roles}）`;
  });

  constructor() {
    provideHeaderTitle(() => ({ title: '沒有權限', breadcrumbs: [] }));
  }
}
