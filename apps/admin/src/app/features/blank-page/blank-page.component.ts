import { Component } from '@angular/core';
import { provideHeaderTitle } from '../../layout/header/header-title';
import { HeaderToolbarDirective } from '../../layout/header/header-toolbar-slot';
import { TemplateInfo, TemplateInfoComponent } from '../../shared/ui/template-info.component';

const INFO: TemplateInfo = {
  summary: '空白頁樣板：只有殼層、頁首（麵包屑、標題）與一張空卡片，是新頁面的起點。整個資料夾只有這一個檔案。',
  components: ['.ui-card、.ui-text-subtitle（造型交給質地）', 'provideHeaderTitle（頁首標題與麵包屑）'],
  replace: ['標題「新頁面」與麵包屑', '卡片裡的「從這裡開始」說明（換成這一頁的內容）', '<app-template-info>（新專案用不到，連同 INFO 一起刪）'],
  files: ['apps/admin/src/app/features/blank-page/blank-page.component.ts'],
};

const ROUTE_SNIPPET = `// features/templates/templates.routes.ts（或 app.routes.ts）
{
  path: 'my-page',
  loadComponent: () => import('../my-page/my-page.component').then((m) => m.MyPageComponent),
},`;

const REGISTRY_SNIPPET = `// showcase/showcase-registry.ts 的 SHOWCASE_ENTRIES
{ id: 'my-page', title: '我的頁面', group: 'templates', icon: 'web', path: 'templates/my-page' },

// showcase/showcase-catalog.ts 的 SHOWCASE_DETAILS（展示目錄的測試會檢查每一筆都有說明）
'my-page': { summary: '這一頁是做什麼的，一句話。', source: 'apps/admin/src/app/features/my-page' },`;

const TITLE_SNIPPET = `provideHeaderTitle(() => ({ title: '我的頁面', breadcrumbs: [{ label: '頁面樣板' }] }));`;

/** 空白頁（頁面樣板，/templates/blank）：複製這個檔案開始一個新頁面。 */
@Component({
  selector: 'app-blank-page',
  imports: [HeaderToolbarDirective, TemplateInfoComponent],
  template: `
    <ng-template appHeaderToolbar>
      <app-template-info [info]="info" />
    </ng-template>

    <section class="ui-card blank p-4 sm:p-6" aria-labelledby="blank-title">
      <h2 id="blank-title" class="ui-text-subtitle">從這裡開始</h2>
      <p class="blank__lede">這一頁只有殼層、頁首與這張卡片。照下面四步，就有一個新頁面。</p>
      <ol class="blank__steps">
        <li>
          <strong>複製這個資料夾。</strong>
          把 <code>features/blank-page/</code> 複製成 <code>features/my-page/</code>，檔名、class 名稱與 selector 一起改。
        </li>
        <li>
          <strong>在 routes 加一筆。</strong>
          <pre class="blank__code"><code>{{ routeSnippet }}</code></pre>
        </li>
        <li>
          <strong>在側欄 registry 加一筆。</strong>
          <pre class="blank__code"><code>{{ registrySnippet }}</code></pre>
        </li>
        <li>
          <strong>換掉標題。</strong>
          改 constructor 裡的頁首標題，刪掉右上角的樣板說明，再把這張卡片換成你的內容。
          <pre class="blank__code"><code>{{ titleSnippet }}</code></pre>
        </li>
      </ol>
    </section>
  `,
  styles: `
    :host {
      display: block;
      max-width: 56rem;
      padding-top: 0.5rem;
    }

    .blank h2,
    .blank__lede {
      margin: 0;
    }

    .blank__lede {
      margin-top: 0.5rem;
      color: var(--mat-sys-on-surface-variant);
      line-height: 1.7;
    }

    .blank__steps {
      display: grid;
      // minmax(0, 1fr)：程式碼區塊自己水平捲動，不把卡片撐寬。
      grid-template-columns: minmax(0, 1fr);
      gap: 1rem;
      margin: 1.25rem 0 0;
      padding-inline-start: 1.5rem;
      // 全域樣式把清單符號拿掉了，步驟要編號。
      list-style: decimal;
      line-height: 1.7;

      li::marker {
        color: var(--mat-sys-on-surface);
        font-weight: 700;
      }

      strong {
        color: var(--mat-sys-on-surface);
      }
    }

    code {
      font-family: var(--font-mono);
      font-size: 0.8125rem;
      overflow-wrap: anywhere;
    }

    // 跟展示頁「用法」的程式碼區塊同一組樣式。
    .blank__code {
      margin: 0.5rem 0 0;
      padding: 1rem;
      overflow-x: auto;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--mat-sys-corner-small);
      background: var(--mat-sys-surface-container-low);
      color: var(--mat-sys-on-surface);
      line-height: 1.6;

      code {
        overflow-wrap: normal;
      }
    }
  `,
})
export class BlankPageComponent {
  protected readonly info = INFO;
  protected readonly routeSnippet = ROUTE_SNIPPET;
  protected readonly registrySnippet = REGISTRY_SNIPPET;
  protected readonly titleSnippet = TITLE_SNIPPET;

  constructor() {
    provideHeaderTitle(() => ({ title: '新頁面', breadcrumbs: [{ label: '頁面樣板' }] }));
  }
}
