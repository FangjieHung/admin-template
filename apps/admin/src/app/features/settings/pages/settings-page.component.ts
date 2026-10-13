import { Component, inject } from '@angular/core';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { AppearancePanelService, ThemeService, texture } from '@car-rental/theme-pack';
import { ZH_TW } from '../../../core/i18n/zh-tw';
import { provideHeaderTitle } from '../../../layout/header/header-title';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [MatSlideToggleModule],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss',
})
export class SettingsPageComponent {
  protected readonly t = ZH_TW;
  protected readonly theme = inject(ThemeService);
  protected readonly texture = texture;
  // ADR 0007：配色列只顯示目前質地的相容配色（不相容的隱藏），過濾邏輯在 ThemeService，這裡不重抄。
  protected readonly colorThemes = this.theme.compatibleThemes;
  // ticket 03：外觀浮動面板開關；狀態放在共用 service，跟 app shell 掛的浮動面板同步。
  protected readonly appearancePanel = inject(AppearancePanelService);

  constructor() {
    // /settings 不在側欄選單裡，由頁面自己設定標題。
    provideHeaderTitle(() => ({ title: this.t.settingsPage.title, breadcrumbs: [] }));
    // ADR 0010：設定頁跟外觀面板一樣列出全部質地，進頁就在背景預先下載按需質地的樣式。
    this.theme.prefetchTextures();
  }

  protected onParadigm(id: string): void {
    // 按需質地載入完成才會真的切換，失敗時 ThemeService 自己退回並提示。
    void this.theme.setParadigm(id);
  }

  protected onTheme(id: string): void {
    this.theme.setTheme(id);
  }

  protected onAppearancePanelToggle(event: MatSlideToggleChange): void {
    this.appearancePanel.setVisible(event.checked);
  }
}
