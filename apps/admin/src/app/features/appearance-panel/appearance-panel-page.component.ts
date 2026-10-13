import { Component, computed, inject } from '@angular/core';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { AppearancePanelService, COLOR_THEMES, ThemeService, texture } from '@admin-template/theme-pack';
import { DemoBlockComponent } from '../../showcase/demo-block.component';
import { ApiSection, ShowcasePageComponent } from '../../showcase/showcase-page.component';
import { detailOf } from '../../showcase/showcase-catalog';

const ENTRY = detailOf('appearance-panel');

@Component({
  selector: 'app-appearance-panel-page',
  imports: [MatSlideToggleModule, ShowcasePageComponent, DemoBlockComponent],
  template: `
    <app-showcase-page [summary]="entry.summary" [whenToUse]="whenToUse" [avoid]="avoid" [source]="entry.source" [usage]="usage" [api]="api">
      <app-demo-block heading="開啟面板" description="打開後每一頁角落會出現一顆按鈕，點開可切換質地與配色、拖曳到不擋路的位置；狀態跟設定頁的開關同步。">
        <mat-slide-toggle [checked]="panel.visible()" (change)="onToggle($event)">顯示外觀浮動面板</mat-slide-toggle>
        <dl class="demo-state mt-4">
          <div><dt>目前質地</dt><dd>{{ textureLabel() }}</dd></div>
          <div><dt>目前配色</dt><dd>{{ themeLabel() }}</dd></div>
          <div><dt>這個質地的相容配色</dt><dd>{{ theme.compatibleThemes().length }} 套</dd></div>
        </dl>
        <p class="demo-note">相容清單只存在 theme.token.ts 的 TEXTURE_COMPATIBILITY；面板與設定頁都只列出相容的配色。</p>
      </app-demo-block>
    </app-showcase-page>
  `,
  styleUrl: '../../showcase/demo-shared.scss',
})
export class AppearancePanelPageComponent {
  protected readonly entry = ENTRY;
  protected readonly panel = inject(AppearancePanelService);
  protected readonly theme = inject(ThemeService);

  protected readonly textureLabel = computed(() => texture.find((t) => t.id === this.theme.paradigm())?.label ?? this.theme.paradigm());
  protected readonly themeLabel = computed(() => COLOR_THEMES.find((c) => c.id === this.theme.theme())?.label ?? this.theme.theme());

  protected onToggle(event: MatSlideToggleChange): void {
    this.panel.setVisible(event.checked);
  }

  protected readonly whenToUse = [
    '展示與驗收：一邊操作一邊切換質地、配色，確認每一頁在每種外觀下都正常。',
    '讓使用者自己挑外觀的產品（新專案只留一兩種外觀時，照刪減指南把面板整個刪掉）。',
  ];
  protected readonly avoid = ['正式產品只有一種外觀：刪掉面板（docs/guides/theme-pruning.md 第 3 節）。'];

  protected readonly usage = `<!-- app.html：掛在殼層最外層，開關打開才載入（@defer） -->
@defer (when appearancePanel.visible()) {
  <lib-floating-appearance-panel />
}

// app.ts
protected readonly appearancePanel = inject(AppearancePanelService);
// 面板元件走深路徑匯入，@defer 才能把它拆成獨立 chunk
import { FloatingAppearancePanelComponent } from '@admin-template/theme-pack/floating-appearance-panel';`;

  protected readonly api: ApiSection[] = [
    {
      title: 'AppearancePanelService',
      rows: [
        { name: 'visible', type: 'WritableSignal<boolean>', default: 'localStorage', description: '面板是否顯示；記在瀏覽器（app.appearancePanel）。' },
        { name: 'setVisible(value)', type: 'void', description: '開關面板並記住。' },
      ],
    },
    {
      title: 'ThemeService（面板與設定頁共用）',
      rows: [
        { name: 'paradigm()／theme()', type: 'Signal<string>', description: '目前質地／配色 id。' },
        { name: 'compatibleThemes()', type: 'Signal<ThemeOption[]>', description: '目前質地相容的配色。' },
        { name: 'setParadigm(id)', type: 'Promise<void>', description: '切換質地；按需質地下載完才套用，失敗時退回 Material 並提示。' },
        { name: 'setTheme(id)', type: 'Promise<void>', description: '切換配色；按需配色下載完才套用，失敗時退回 Verdant 並提示。' },
        { name: 'pendingParadigm()／pendingTheme()', type: 'Signal<string | null>', description: '已選、樣式還在下載的質地／配色。' },
        { name: 'prefetchTextures()／prefetchColors()', type: 'void', description: '背景預先下載按需質地／按需配色的樣式。' },
      ],
    },
  ];
}
