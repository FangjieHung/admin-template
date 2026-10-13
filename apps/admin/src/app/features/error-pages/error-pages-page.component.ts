import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ErrorPageComponent } from '../errors/error-page.component';
import { DemoBlockComponent } from '../../showcase/demo-block.component';
import { ApiSection, ShowcasePageComponent } from '../../showcase/showcase-page.component';
import { detailOf } from '../../showcase/showcase-catalog';

const ENTRY = detailOf('error-pages');

/** 錯誤頁樣板展示頁（/components/error-pages）：找不到頁面（404）與沒有權限。 */
@Component({
  selector: 'app-error-pages-page',
  imports: [RouterLink, ErrorPageComponent, ShowcasePageComponent, DemoBlockComponent],
  template: `
    <app-showcase-page
      [summary]="entry.summary"
      [whenToUse]="whenToUse"
      [avoid]="avoid"
      [source]="entry.source"
      [usage]="usage"
      [api]="api"
    >
      <app-demo-block
        heading="找不到頁面（404）"
        description="任何不認得的網址（路由的 **）。實際頁面："
      >
        <p class="demo-note error-demo__link"><a routerLink="/components/does-not-exist">/components/does-not-exist</a></p>
        <div class="error-demo__stage">
          <app-error-page
            headingId="demo-404-title"
            icon="travel_explore"
            code="404"
            heading="找不到這一頁"
            message="網址可能打錯了，或這一頁已經移除。請確認網址，或回首頁從側欄重新找。"
          />
        </div>
      </app-demo-block>

      <app-demo-block
        heading="沒有權限"
        description="accessGuard 擋下時顯示（網址列維持原本的網址）：說明需要的權限與目前身分，換成有權限的身分會自動回到那一頁。用「成員」帳號開啟："
      >
        <p class="demo-note error-demo__link"><a routerLink="/access-demo/report">/access-demo/report</a>（需要報表・檢視）</p>
        <div class="error-demo__stage">
          <app-error-page
            headingId="demo-403-title"
            icon="lock"
            code="403"
            heading="沒有權限"
            message="你目前的身分不能開啟這一頁。如果需要，請聯絡系統管理員調整角色。"
          />
        </div>
      </app-demo-block>
    </app-showcase-page>
  `,
  styleUrl: '../../showcase/demo-shared.scss',
  styles: `
    .error-demo__link {
      margin: 0 0 0.75rem;
    }

    .error-demo__stage {
      padding: 0 0 2rem;
      border: 1px dashed var(--mat-sys-outline-variant);
      border-radius: var(--mat-sys-corner-medium);
      background: var(--mat-sys-surface-container-low);
    }
  `,
})
export class ErrorPagesPageComponent {
  protected readonly entry = ENTRY;

  protected readonly whenToUse = [
    '網址打錯或頁面已移除：找不到頁面。',
    '直接開了沒有權限的網址：沒有權限（由 accessGuard 導過來）。',
  ];
  protected readonly avoid = [
    '某一塊資料載入失敗：在原地用錯誤狀態與重試（見「載入、空白、錯誤」），不要換掉整頁。',
    '按鈕沒有權限：直接隱藏，或停用並說明（見「權限控制」）。',
  ];

  protected readonly usage = `// app.routes.ts
{ path: 'forbidden', loadComponent: () => import('./features/errors/forbidden-page.component') ... },
{ path: '**', loadComponent: () => import('./features/errors/not-found-page.component') ... },

// 其他錯誤頁照抄一頁，換掉文字
<app-error-page icon="build" heading="系統維護中" message="預計 30 分鐘後恢復。" />`;

  protected readonly api: ApiSection[] = [
    {
      title: 'app-error-page 輸入',
      rows: [
        { name: 'icon', type: 'string', default: '必填', description: 'Material Symbols 圖示名稱。' },
        { name: 'code', type: 'string', default: "''", description: '例：「404」「403」；不給就不顯示。' },
        { name: 'heading', type: 'string', default: '必填', description: '發生什麼事，一句話。' },
        { name: 'message', type: 'string', default: '必填', description: '可以怎麼辦。' },
        { name: 'actionLabel / actionRoute', type: 'string', default: '「回首頁」/「/」', description: '主要動作。' },
        { name: '[errorPageSecondary]', type: '內容投影', description: '第二個動作（例：「換個帳號登入」）；其他投影內容放在說明下方。' },
      ],
    },
  ];
}
