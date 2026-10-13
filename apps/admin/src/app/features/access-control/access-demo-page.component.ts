import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { ACCESS_DATA_KEY, AccessService, CanDirective, DisabledUnlessDirective, actionsOf, parsePermission } from '@admin-template/access';
import { provideHeaderTitle } from '../../layout/header/header-title';

/** 「權限控制」路由守門示範的目的頁（/access-demo/<功能>）：看得到這一頁就代表有該功能的「檢視」。 */
@Component({
  selector: 'app-access-demo-page',
  imports: [RouterLink, MatButtonModule, CanDirective, DisabledUnlessDirective],
  template: `
    <section class="ui-card access-demo p-4 sm:p-6" aria-labelledby="access-demo-title">
      <p class="ui-text-caption">路由守門示範</p>
      <h2 id="access-demo-title" class="ui-text-subtitle">{{ feature().label }}</h2>
      <p class="access-demo__lede">
        你有「{{ feature().label }}・檢視」權限，所以看得到這一頁。換成沒有這個權限的身分，這一頁會立刻變成「沒有權限」。
      </p>
      <div class="access-demo__actions">
        <button type="button" matButton="filled" *libCan="feature().id + ':create'">新增{{ feature().label }}</button>
        <button type="button" matButton="outlined" *libCan="feature().id + ':edit'">編輯</button>
        @if (hasApprove()) {
          <button type="button" matButton="outlined" [libDisabledUnless]="feature().id + ':approve'">核准</button>
        }
        <a matButton routerLink="/components/access-control">回「權限控制」</a>
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .access-demo__lede {
      margin: 0.5rem 0 0;
      max-width: 68ch;
      line-height: 1.7;
      color: var(--mat-sys-on-surface-variant);
    }

    .access-demo__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-top: 1.25rem;
    }
  `,
})
export class AccessDemoPageComponent {
  private readonly access = inject(AccessService);
  private readonly data = inject(ActivatedRoute).snapshot.data;

  protected readonly feature = computed(() => {
    const id = parsePermission(String(this.data[ACCESS_DATA_KEY] ?? ''))?.feature ?? '';
    return this.access.features.find((f) => f.id === id) ?? { id, label: id };
  });

  protected readonly hasApprove = computed(() => {
    const feature = this.access.features.find((f) => f.id === this.feature().id);
    return !!feature && actionsOf(feature).includes('approve');
  });

  constructor() {
    provideHeaderTitle(() => ({
      title: `示範：${this.feature().label}`,
      breadcrumbs: [{ label: '權限控制', route: '/components/access-control' }],
    }));
  }
}
