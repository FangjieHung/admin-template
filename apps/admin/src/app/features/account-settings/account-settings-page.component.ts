import { Component, DestroyRef, ElementRef, Injector, afterNextRender, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { provideHeaderTitle } from '../../layout/header/header-title';
import { HeaderToolbarDirective } from '../../layout/header/header-toolbar-slot';
import {
  CONFIRM_DIALOG_LABEL_PROVIDERS,
  FEEDBACK_STATE_LABEL_PROVIDERS,
  TOAST_PROVIDERS,
} from '../../shared/ui/component-label-providers';
import { TemplateInfo, TemplateInfoComponent } from '../../shared/ui/template-info.component';
import { SETTINGS_SECTIONS, SettingsSectionId } from './data/account-settings.model';

const INFO: TemplateInfo = {
  summary:
    '設定頁樣板：左側分組導覽（窄螢幕變成頂端可捲動的分頁列），分組寫在網址上。一頁示範兩種儲存方式——' +
    '「明確存檔」（個人資料、偏好、變更密碼：底部出現「有未儲存的變更」列，按儲存才送出，切換分組或離開前會先問）；' +
    '「即時儲存」（通知、兩步驟驗證：改了就存並提示，失敗時還原）。' +
    '一次會改好幾個欄位、改到一半不該生效、或需要驗證的，用明確存檔；一個開關就是一個完整決定、可以馬上反悔的，用即時儲存。' +
    '這是給新專案複製的「使用者自己的設定」；側欄使用者選單裡的「設定」（/settings）是展示 app 本身的外觀與示範工具，兩者無關。',
  components: [
    'Material：mat-form-field、matInput、mat-select、mat-radio-group、mat-slide-toggle、mat-error',
    '原生勾選框（通知表，外觀由質地重畫）',
    '確認對話框（未存離開、登出裝置；刪除帳號用 typeToConfirm 要求輸入 Email）、lib-toast、lib-skeleton',
    'libs/access 的 unsavedChangesGuard（子路由離開前呼叫 canLeave）',
  ],
  replace: [
    'data/account-settings.repository.ts：每個方法換成呼叫後端（介面已經是非同步的）',
    'data/account-settings.model.ts：分組、時區、通知事件與管道、日期格式、預設首頁的選項',
    'sections/password-rules.ts：密碼規則換成自己的政策（伺服器要再檢查一次）',
    '示範用的失敗：「每日摘要 × Email」第一次固定失敗、網址的 ?demo=fail、目前密碼 wrong-password',
  ],
  files: [
    'apps/admin/src/app/features/account-settings/',
    'apps/admin/src/app/features/templates/templates.routes.ts（loadChildren）',
  ],
};

/**
 * 設定頁（頁面樣板，/templates/settings/<分組>）：只負責外框——頁首、分組導覽、子路由出口。
 * 各分組是自己的元件（sections/），新專案不要的分組刪掉元件與這裡的一筆即可。
 * 分組元件用到的提示訊息、確認對話框文字在這裡提供（子路由的元件讀得到外框的 providers）。
 */
@Component({
  selector: 'app-account-settings-page',
  imports: [RouterLink, RouterOutlet, HeaderToolbarDirective, TemplateInfoComponent],
  providers: [...CONFIRM_DIALOG_LABEL_PROVIDERS, ...FEEDBACK_STATE_LABEL_PROVIDERS, ...TOAST_PROVIDERS],
  template: `
    <ng-template appHeaderToolbar>
      <app-template-info [info]="info" />
    </ng-template>

    <div class="acs">
      <nav class="acs__nav" aria-label="設定分組">
        <ul class="acs__nav-list">
          @for (s of sections; track s.id) {
            <li>
              <a
                class="ui-nav-pill acs__link"
                [routerLink]="s.id"
                queryParamsHandling="preserve"
                [class.is-active]="active() === s.id"
                [attr.aria-current]="active() === s.id ? 'page' : null"
                [attr.data-section]="s.id"
              >
                <span class="material-symbols-rounded" aria-hidden="true">{{ s.icon }}</span>
                {{ s.label }}
              </a>
            </li>
          }
        </ul>
      </nav>
      <div class="acs__content">
        <router-outlet />
      </div>
    </div>
  `,
  styleUrl: './account-settings-page.component.scss',
})
export class AccountSettingsPageComponent {
  protected readonly info = INFO;
  protected readonly sections = SETTINGS_SECTIONS;

  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  /**
   * 目前的分組：子路由網址的第一段。自己算，不用 RouterLinkActive——它跟 RouterLink 在同一個套件檔案裡，
   * 殼層已經用到那個檔案，lazy 頁面一用 RouterLinkActive 就會被併進 Initial bundle（約 3 kB）。
   */
  protected readonly active = signal<SettingsSectionId | null>(this.currentSection());

  constructor() {
    provideHeaderTitle(() => ({ title: '設定', breadcrumbs: [{ label: '頁面樣板' }] }));
    const sub = inject(Router)
      .events.pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        this.active.set(this.currentSection());
        afterNextRender(() => this.revealActive(), { injector: this.injector });
      });
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
  }

  /** 窄螢幕的分頁列可以水平捲動：把目前項目捲進可見範圍（只動水平捲動，不捲整頁）。 */
  private revealActive(): void {
    const list = this.host.nativeElement.querySelector<HTMLElement>('.acs__nav-list');
    const item = list?.querySelector<HTMLElement>('.is-active');
    if (!list || !item || list.scrollWidth <= list.clientWidth) return;
    const left = item.offsetLeft - list.offsetLeft;
    if (left < list.scrollLeft || left + item.offsetWidth > list.scrollLeft + list.clientWidth) {
      list.scrollLeft = left - (list.clientWidth - item.offsetWidth) / 2;
    }
  }

  private currentSection(): SettingsSectionId | null {
    // 外框建立時子路由還沒啟用（子路由的 snapshot 還沒設定），所以從外框自己的 snapshot 往下找。
    const path = this.route.snapshot?.firstChild?.url[0]?.path;
    return this.sections.find((s) => s.id === path)?.id ?? null;
  }
}
