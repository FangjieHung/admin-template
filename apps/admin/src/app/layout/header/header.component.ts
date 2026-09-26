import { Component, computed, inject, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { ZH_TW } from '../../core/i18n/zh-tw';
import { HeaderToolbarSlot } from './header-toolbar-slot';
import { HeaderTitleExtraSlot } from './header-title-extra-slot';
import { HeaderTitleData, HeaderTitleSlot } from './header-title';

/**
 * 頁首：麵包屑（上層路徑，可點）＋大標題（這一頁的名字，頁面唯一的 h1）。
 * 預設值（`defaultTitle`）由 App 依側欄選單算出；頁面可透過 `provideHeaderTitle()`
 * （header-title.ts）登記覆寫，蓋過預設值——訂單詳情、車輛詳情等標題含動態資料的頁面都是這樣做。
 */
@Component({
  selector: 'app-header',
  imports: [NgTemplateOutlet, RouterLink, MatButtonModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  protected readonly t = ZH_TW;

  readonly defaultTitle = input.required<HeaderTitleData>();
  readonly menuToggle = output<void>();

  private readonly titleSlot = inject(HeaderTitleSlot);
  protected readonly toolbarTemplate = inject(HeaderToolbarSlot).template;
  protected readonly titleExtraTemplate = inject(HeaderTitleExtraSlot).template;

  private readonly current = computed<HeaderTitleData>(
    () => this.titleSlot.entry()?.value ?? this.defaultTitle(),
  );
  protected readonly currentTitle = computed(() => this.current().title);
  protected readonly breadcrumbs = computed(() => this.current().breadcrumbs);
  protected readonly backTo = computed(() => this.current().backTo ?? null);
}
