import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommandPaletteLabels } from './command-palette-labels';
import type { CommandEntry } from './command-palette.component';

const KIND_ICON = { page: 'description', record: 'article', action: 'bolt' } as const;

/** 清單裡的一列（內部元件，讓每份樣式表留在 8 kB 以內）。滑鼠與點擊由面板處理。 */
@Component({
  selector: 'div[lib-command-option]',
  templateUrl: './command-option.component.html',
  styleUrl: './command-option.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'lib-command-option',
    role: 'option',
    '[id]': 'entry().optionId',
    '[attr.aria-selected]': 'active()',
    '[class.is-active]': 'active()',
    '[attr.data-kind]': 'entry().item.kind',
    '[attr.data-command-id]': 'entry().item.id',
  },
})
export class CommandOptionComponent {
  readonly entry = input.required<CommandEntry>();
  readonly active = input(false);
  readonly labels = input.required<CommandPaletteLabels>();

  protected readonly icon = computed(() => this.entry().item.icon || KIND_ICON[this.entry().item.kind]);
}
