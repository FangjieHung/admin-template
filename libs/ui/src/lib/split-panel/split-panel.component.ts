import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import {
  RESPONSIVE_PANEL_NARROW_QUERY,
  ResponsivePanelComponent,
} from '../responsive-panel/responsive-panel.component';

/**
 * 分割檢視：預設內容（清單）在左，`[splitPanelContent]` 投影的內容（詳情或編輯表單）開在右側，不離開清單。
 *
 * 面板本身就是 lib-responsive-panel：標題、關閉鈕、Esc、開關時的焦點、窄螢幕的浮層與焦點鎖定都沿用它；
 * 這個元件只負責兩欄版面——寬螢幕時面板是一張 `.ui-card`（外觀交給質地 recipe）、捲動清單時黏在捲動容器頂端；
 * 窄螢幕（同 responsive-panel 的斷點）時面板蓋滿整個畫面。要標出清單裡正在開的那一列，
 * 把同一個 id 傳給 lib-data-table 的 `[activeRowId]`。
 */
@Component({
  selector: 'lib-split-panel',
  imports: [ResponsivePanelComponent],
  templateUrl: './split-panel.component.html',
  styleUrl: './split-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'lib-split-panel',
    '[class.lib-split-panel--open]': 'open() && !narrow()',
  },
})
export class SplitPanelComponent {
  /** 面板是否開著。 */
  readonly open = input(false);
  /** 面板標題（h2）；空字串時用 closeLabel 當面板的無障礙名稱。 */
  readonly heading = input('');
  /** 關閉鈕與窄螢幕遮罩的無障礙名稱（元件不內建文字）。 */
  readonly closeLabel = input.required<string>();
  /** 使用者要關閉面板：按關閉鈕、按 Esc 或點窄螢幕的遮罩。 */
  readonly closed = output<void>();

  protected readonly narrow = toSignal(
    inject(BreakpointObserver)
      .observe([RESPONSIVE_PANEL_NARROW_QUERY])
      .pipe(map((result) => result.matches)),
    { initialValue: false },
  );
}
