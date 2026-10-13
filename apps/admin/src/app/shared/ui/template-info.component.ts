import { Component, input } from '@angular/core';

/** 「樣板說明」面板的內容：每個頁面樣板自己提供（文字跟著樣板的 lazy chunk，不進 Initial bundle）。 */
export interface TemplateInfo {
  /** 一句話：這一頁是什麼。 */
  summary: string;
  /** 用到的元件。 */
  components: readonly string[];
  /** 新專案複製這一頁後要換掉的示範資料。 */
  replace: readonly string[];
  /** 檔案位置。 */
  files: readonly string[];
}

/**
 * 頁面樣板右上角不起眼的「樣板說明」入口：按下打開一個小面板，說明用到哪些元件、要換掉哪些示範資料、檔案在哪。
 * 用瀏覽器原生的 popover（不需要 Material 的選單或對話框）：點外面或按 Esc 會關閉，焦點回到按鈕。
 * 新專案複製樣板後，把這個元件連同 `<app-template-info>` 一起刪掉即可。
 */
@Component({
  selector: 'app-template-info',
  template: `
    <button type="button" class="tpl-info__trigger" popovertarget="tpl-info-panel" aria-haspopup="dialog">
      <span class="material-symbols-rounded" aria-hidden="true">info</span>
      <span class="tpl-info__trigger-text">樣板說明</span>
    </button>
    <div id="tpl-info-panel" class="tpl-info__panel" popover role="dialog" aria-labelledby="tpl-info-title">
      <div class="tpl-info__head">
        <h2 id="tpl-info-title" class="ui-text-subtitle">樣板說明</h2>
        <button type="button" class="tpl-info__close" popovertarget="tpl-info-panel" popovertargetaction="hide" aria-label="關閉樣板說明">
          <span class="material-symbols-rounded" aria-hidden="true">close</span>
        </button>
      </div>
      <p class="tpl-info__summary">{{ info().summary }}</p>
      <h3 class="tpl-info__heading">用到的元件</h3>
      <ul>
        @for (item of info().components; track item) {
          <li>{{ item }}</li>
        }
      </ul>
      <h3 class="tpl-info__heading">要換掉的示範資料</h3>
      <ul>
        @for (item of info().replace; track item) {
          <li>{{ item }}</li>
        }
      </ul>
      <h3 class="tpl-info__heading">檔案</h3>
      <ul class="tpl-info__files">
        @for (item of info().files; track item) {
          <li><code>{{ item }}</code></li>
        }
      </ul>
    </div>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    .tpl-info__trigger,
    .tpl-info__close {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      min-height: 2.5rem;
      padding: 0 0.625rem;
      border: 0;
      border-radius: var(--mat-sys-corner-small);
      background: transparent;
      color: var(--mat-sys-on-surface-variant);
      font: inherit;
      font-size: 0.8125rem;
      cursor: pointer;
      transition: background-color var(--app-motion-fast) var(--app-ease-standard);

      .material-symbols-rounded {
        font-size: 1.25rem;
      }

      &:hover {
        background: var(--app-state-hover);
        color: var(--mat-sys-on-surface);
      }

      &:focus-visible {
        outline: var(--app-focus-ring-width) solid var(--app-focus-ring);
        outline-offset: var(--app-focus-ring-offset);
      }
    }

    .tpl-info__close {
      min-width: 2.5rem;
      justify-content: center;
      padding: 0;
    }

    // 原生 popover 在最上層（top layer），不受捲動容器裁切；位置固定在視窗右上角。
    .tpl-info__panel {
      position: fixed;
      inset: 4.5rem 1rem auto auto;
      width: min(26rem, calc(100vw - 2rem));
      max-height: calc(100dvh - 6rem);
      margin: 0;
      padding: 1rem 1.25rem 1.25rem;
      overflow: auto;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--mat-sys-corner-medium);
      background: var(--mat-sys-surface-container-high);
      color: var(--mat-sys-on-surface);
      box-shadow: var(--mat-sys-level3);
      font-size: 0.875rem;
      line-height: 1.6;

      ul {
        margin: 0.25rem 0 0;
        padding-inline-start: 1.25rem;
        list-style: disc;
      }

      code {
        font-family: var(--font-mono);
        font-size: 0.8125rem;
        overflow-wrap: anywhere;
      }
    }

    .tpl-info__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 0.25rem;

      h2 {
        margin: 0;
      }
    }

    .tpl-info__summary {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
    }

    .tpl-info__heading {
      margin: 0.875rem 0 0;
      font-size: 0.8125rem;
      font-weight: 700;
    }

    .tpl-info__panel .tpl-info__files {
      list-style: none;
      padding-inline-start: 0;
    }

    @media (max-width: 640px) {
      .tpl-info__trigger-text {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }

      .tpl-info__trigger {
        position: relative;
        min-width: 2.5rem;
        justify-content: center;
        padding: 0;
      }

      .tpl-info__panel {
        inset: auto 1rem 1rem 1rem;
        width: auto;
      }
    }
  `,
})
export class TemplateInfoComponent {
  readonly info = input.required<TemplateInfo>();
}
