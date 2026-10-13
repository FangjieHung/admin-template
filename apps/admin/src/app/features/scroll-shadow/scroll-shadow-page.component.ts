import { Component } from '@angular/core';
import { ScrollShadowDirective } from '@admin-template/ui';
import { makeDemoItems } from '../../showcase/demo-data';
import { DemoBlockComponent } from '../../showcase/demo-block.component';
import { ApiSection, ShowcasePageComponent } from '../../showcase/showcase-page.component';
import { detailOf } from '../../showcase/showcase-catalog';

const ENTRY = detailOf('scroll-shadow');

@Component({
  selector: 'app-scroll-shadow-page',
  imports: [ScrollShadowDirective, ShowcasePageComponent, DemoBlockComponent],
  template: `
    <app-showcase-page [summary]="entry.summary" [whenToUse]="whenToUse" [avoid]="avoid" [source]="entry.source" [usage]="usage" [api]="api">
      <app-demo-block heading="捲動清單" description="往下捲：頂端出現陰影表示上面還有；捲到底，底部陰影消失。陰影是這一頁自己的 CSS（::before／::after＋sticky）。">
        <div class="scroller" libScrollShadow>
          <ul class="demo-list">
            @for (item of items; track item.id) {
              <li><span class="demo-list__title">{{ item.title }}</span><span class="demo-list__meta ui-text-numeric">{{ item.code }}</span></li>
            }
          </ul>
        </div>
      </app-demo-block>
    </app-showcase-page>
  `,
  styleUrl: '../../showcase/demo-shared.scss',
  styles: `
    .scroller {
      position: relative;
      max-height: 18rem;
      overflow-y: auto;
      padding: 0 1rem;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--mat-sys-corner-medium);
    }

    // 陰影畫在內容之上：sticky 的偽元素，高度 0、用 box-shadow 往內投影。
    .scroller::before,
    .scroller::after {
      content: '';
      position: sticky;
      display: block;
      height: 0;
      margin: 0 -1rem;
      opacity: 0;
      transition: opacity var(--app-motion-fast) var(--app-ease-standard);
      pointer-events: none;
      z-index: 1;
    }

    .scroller::before {
      top: 0;
      box-shadow: 0 0 0.75rem 0.5rem color-mix(in srgb, var(--app-shadow-tint) 18%, transparent);
    }

    .scroller::after {
      bottom: 0;
      box-shadow: 0 0 0.75rem 0.5rem color-mix(in srgb, var(--app-shadow-tint) 18%, transparent);
    }

    .scroller.has-more-above::before,
    .scroller.has-more-below::after {
      opacity: 1;
    }
  `,
})
export class ScrollShadowPageComponent {
  protected readonly entry = ENTRY;
  protected readonly items = makeDemoItems(24);

  protected readonly whenToUse = ['固定高度、內容會捲動的區塊（側板、長表單的內容區、下拉清單）。', '捲軸不明顯（macOS、觸控裝置）時提示「還有內容」。'];
  protected readonly avoid = ['整頁捲動：瀏覽器的捲軸已經夠清楚。'];

  protected readonly usage = `<!-- host 本身就是捲動容器 -->
<div class="scroller" libScrollShadow>…</div>

<!-- 捲動容器在第三方元件裡面：給 CSS 選擇器 -->
<mat-stepper libScrollShadow=".mat-horizontal-content-container">…</mat-stepper>

/* 陰影由使用端畫：依 class 顯示 */
.scroller.has-more-above::before, .scroller.has-more-below::after { opacity: 1; }`;

  protected readonly api: ApiSection[] = [
    {
      title: '輸入',
      rows: [{ name: 'libScrollShadow', type: 'string', default: "''", description: 'host 內部捲動容器的 CSS 選擇器；空字串代表 host 本身。內部節點被換掉時會自動重新綁定。' }],
    },
    {
      title: '加上的 class',
      rows: [
        { name: 'has-more-above', type: '—', description: '上面還有內容（scrollTop > 1px）。' },
        { name: 'has-more-below', type: '—', description: '下面還有內容。' },
      ],
    },
  ];
}
