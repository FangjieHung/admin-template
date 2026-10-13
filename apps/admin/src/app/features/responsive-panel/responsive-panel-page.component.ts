import { Component, computed, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { ResponsivePanelComponent } from '@car-rental/ui';
import { ZH_TW } from '../../core/i18n/zh-tw';
import { DEMO_CONTACTS } from '../../showcase/demo-data';
import { DemoBlockComponent } from '../../showcase/demo-block.component';
import { ApiSection, ShowcasePageComponent } from '../../showcase/showcase-page.component';
import { detailOf } from '../../showcase/showcase-catalog';

const ENTRY = detailOf('responsive-panel');

@Component({
  selector: 'app-responsive-panel-page',
  imports: [MatButtonModule, ResponsivePanelComponent, ShowcasePageComponent, DemoBlockComponent],
  templateUrl: './responsive-panel-page.component.html',
  styleUrls: ['../../showcase/demo-shared.scss', './responsive-panel-page.component.scss'],
})
export class ResponsivePanelPageComponent {
  protected readonly entry = ENTRY;
  protected readonly closeLabel = ZH_TW.common.closePanel;
  protected readonly contacts = DEMO_CONTACTS;
  protected readonly selectedId = signal<string | null>(DEMO_CONTACTS[0].id);
  protected readonly selected = computed(() => this.contacts.find((c) => c.id === this.selectedId()) ?? null);

  protected readonly whenToUse = [
    '清單＋詳情：點一筆資料，在旁邊看詳情或編輯，不離開清單。',
    '同一份內容在桌機要並排、在手機要全螢幕。',
  ];
  protected readonly avoid = ['需要使用者先處理完才能繼續的內容：用對話框。', '整頁的詳情：做成詳情頁（頁面樣板規劃中）。'];

  protected readonly usage = `<div class="split">
  <section class="split__list">…清單…</section>
  <section class="split__panel">
    <lib-responsive-panel [open]="!!selected()" [heading]="selected()?.name ?? ''" closeLabel="關閉面板" (closed)="selectedId.set(null)">
      …詳情內容…
    </lib-responsive-panel>
  </section>
</div>`;

  protected readonly api: ApiSection[] = [
    {
      title: '輸入與輸出',
      rows: [
        { name: '[open]', type: 'boolean', default: 'false', description: '是否顯示。' },
        { name: '[heading]', type: 'string', default: "''", description: '面板標題（h2）；空字串時用 closeLabel 當無障礙名稱。' },
        { name: 'closeLabel', type: 'string', default: '必填', description: '關閉鈕與窄螢幕遮罩的無障礙名稱。' },
        { name: '[showCloseButton]', type: 'boolean', default: 'true', description: '寬螢幕時常設 false（面板一直都在）。' },
        { name: '[showHeaderDivider]', type: 'boolean', default: 'true', description: '標題下方的分隔線；內容是分頁標籤時可關掉。' },
        { name: '(closed)', type: 'void', description: '按關閉、按 Esc 或點遮罩。' },
        { name: '[panelHeaderExtra]（內容投影）', type: '—', description: '放在標題旁的額外內容（例如狀態標籤）。' },
      ],
    },
    {
      title: '行為',
      rows: [
        { name: '≤ 1280px', type: '—', description: '移到全螢幕浮層（role=dialog、aria-modal），焦點鎖在面板內，關閉後回到原本的元素。' },
        { name: '> 1280px', type: '—', description: '留在原位，寬度由放它的容器決定。' },
      ],
    },
  ];
}
