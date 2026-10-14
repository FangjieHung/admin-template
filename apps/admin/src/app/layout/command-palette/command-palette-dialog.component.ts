import { Component, Injector, ViewEncapsulation, inject, output } from '@angular/core';
import { CommandItem, CommandPaletteComponent, createLocalStorageCommandHistory } from '@admin-template/ui';
import { COMMAND_PALETTE_LABEL_PROVIDERS, ZH_TW_APP_COMMANDS } from '../../shared/ui/command-palette-labels';
import { createAppCommandProviders } from './app-command-providers';

/** 最近使用存在這台裝置的瀏覽器（localStorage，讀寫失敗時當作沒有紀錄）。 */
export const COMMAND_HISTORY_KEY = 'app.commandPalette.recent';

/**
 * 頁首 ⌘K 打開的對話框：外框（對話框角色、位置）在這裡，搜尋框與結果是 lib-command-palette。
 * 第一次打開時才跟著 command-palette-host.ts 一起動態載入；Initial bundle 只有頁首的按鈕與快捷鍵。
 */
@Component({
  selector: 'app-command-palette-dialog',
  imports: [CommandPaletteComponent],
  providers: [...COMMAND_PALETTE_LABEL_PROVIDERS],
  template: `<lib-command-palette
    mode="dialog"
    [providers]="providers"
    [history]="history"
    (selected)="ran.emit($event)"
    (closed)="closed.emit()"
  />`,
  // overlay pane 的位置與 600px 以下的滿版要寫在全域；每條規則都以 app-cmdk- 開頭。
  encapsulation: ViewEncapsulation.None,
  styles: `
    .app-cmdk-dialog {
      display: flex;
      width: 100%;
      max-height: calc(100vh - 16vh);
    }

    .cdk-overlay-pane.app-cmdk-pane {
      width: min(var(--lib-cmdk-width, 40rem), calc(100vw - 2rem));
    }

    @media (max-width: 600px) {
      .cdk-overlay-pane.app-cmdk-pane {
        position: fixed !important;
        inset: 0 !important;
        width: 100% !important;
        max-width: none !important;
        margin: 0 !important;
        transform: none !important;
      }

      .app-cmdk-pane .app-cmdk-dialog {
        height: 100%;
        max-height: none;
      }

      .app-cmdk-pane .lib-command-palette {
        flex: 1 1 auto;
        border-width: 0;
        border-radius: 0;
        box-shadow: none;
      }

      .app-cmdk-pane .lib-command-palette .cmdk-list {
        max-height: none;
      }
    }
  `,
  host: {
    class: 'app-cmdk-dialog',
    role: 'dialog',
    'aria-modal': 'true',
    '[attr.aria-label]': 'label',
  },
})
export class CommandPaletteDialogComponent {
  /** 選了要執行的項目：外框先關閉（焦點回到觸發的按鈕），項目接著執行。 */
  readonly ran = output<CommandItem>();
  /** 在最上層、查詢空白時按了 Esc。 */
  readonly closed = output<void>();

  protected readonly label = ZH_TW_APP_COMMANDS.dialog;
  protected readonly providers = createAppCommandProviders(inject(Injector));
  protected readonly history = createLocalStorageCommandHistory(COMMAND_HISTORY_KEY);
}
