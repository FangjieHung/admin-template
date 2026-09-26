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
    // 2.1：/settings 不在側欄選單裡，找不到選單對應時不再誤退回「總覽」，改由頁面自己設定標題。
    provideHeaderTitle(() => ({ title: this.t.settingsPage.title, breadcrumbs: [] }));
  }

  protected onParadigm(id: string): void {
    this.theme.setParadigm(id);
  }

  protected onTheme(id: string): void {
    this.theme.setTheme(id);
  }

  protected onAppearancePanelToggle(event: MatSlideToggleChange): void {
    this.appearancePanel.setVisible(event.checked);
  }
}
