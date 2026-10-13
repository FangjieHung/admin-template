import { Component } from '@angular/core';
import { StatusChipComponent } from '@admin-template/ui';
import { PLANNED_ITEMS } from '../../showcase/showcase-catalog';
import { provideHeaderTitle } from '../../layout/header/header-title';

/**
 * 頁面樣板（規劃中）：把通用元件組成的整頁示範，不帶業務規則。目前只列出計畫，
 * 做好一個就在 showcase-registry.ts 加一筆、從這裡的清單移除。
 */
@Component({
  selector: 'app-templates-page',
  imports: [StatusChipComponent],
  template: `
    <section class="ui-card p-4 sm:p-6" aria-labelledby="templates-title">
      <p class="ui-text-caption">規劃中</p>
      <h2 id="templates-title" class="ui-text-subtitle">頁面樣板</h2>
      <p class="templates__lede">
        頁面樣板是用通用元件組成的整頁示範（登入、列表、詳情、表單…），新專案複製一頁、換掉示範資料就能開始。
        已完成的樣板（儀表板，工單的列表、詳情、表單，登入，角色與權限，錯誤頁）在側欄的「頁面樣板」群組；下面是還在規劃中的。
      </p>
      <ul class="templates__list">
        @for (item of templates; track item.title) {
          <li>
            <div class="templates__item-head">
              <span class="templates__name">{{ item.title }}</span>
              <lib-status-chip label="規劃中" status="draft" />
              <span class="ui-text-caption">{{ item.priority }}</span>
            </div>
            <p>{{ item.summary }}</p>
          </li>
        }
      </ul>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .templates__lede {
      margin: 0.5rem 0 0;
      max-width: 72ch;
      line-height: 1.7;
      color: var(--mat-sys-on-surface-variant);
    }

    .templates__list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
      gap: 0.75rem;
      margin: 1.25rem 0 0;
      padding: 0;
      list-style: none;

      li {
        padding: 0.875rem 1rem;
        border: 1px solid var(--mat-sys-outline-variant);
        border-radius: var(--mat-sys-corner-medium);
      }

      p {
        margin: 0.375rem 0 0;
        font-size: 0.875rem;
        color: var(--mat-sys-on-surface-variant);
      }
    }

    .templates__item-head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }

    .templates__name {
      font-weight: 700;
      color: var(--mat-sys-on-surface);
    }
  `,
})
export class TemplatesPageComponent {
  protected readonly templates = PLANNED_ITEMS.filter((item) => item.kind === '頁面樣板');

  constructor() {
    provideHeaderTitle(() => ({ title: '規劃中的樣板', breadcrumbs: [{ label: '頁面樣板' }] }));
  }
}
