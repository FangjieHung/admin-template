import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { StepWizardFieldError } from './step-wizard-fields';

/** 每一步在步驟清單上的狀態。選填（optional）與目前（aria-current）另外標示，不是狀態之一。 */
export type WizardStepState = 'upcoming' | 'current' | 'done' | 'error' | 'locked';

// 以下是 lib-step-wizard 內部用的小元件：拆開是為了讓每個元件的樣式各自在 8 kB 預算內
// （封裝會在每個選擇器加上屬性），也讓標記的狀態規則集中在一處。不從 index.ts 匯出。

/** 步驟標記：數字、完成的勾號或錯誤的驚嘆號（圖示是 inline SVG，不依賴圖示字型）。整個標記只是裝飾，狀態另有文字。 */
@Component({
  selector: 'lib-step-wizard-marker',
  template: `
    @switch (state()) {
      @case ('done') {
        <svg viewBox="0 0 24 24" focusable="false"><path d="m9.6 17.3-5.1-5.1 1.6-1.6 3.5 3.5 8.3-8.3 1.6 1.6z" /></svg>
      }
      @case ('error') {
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M10.6 4h2.8l-.4 10.2h-2zM12 16.4a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6z" />
        </svg>
      }
      @default {
        <span class="ui-text-numeric">{{ number() }}</span>
      }
    }
  `,
  styleUrl: './step-wizard-marker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[attr.data-state]': 'state()',
    '[class.is-current]': 'current()',
  },
})
export class StepWizardMarkerComponent {
  readonly state = input.required<WizardStepState>();
  readonly number = input.required<number>();
  readonly current = input(false);
}

/** 錯誤摘要：標題、補充說明、要修正的欄位（按下聚焦那個欄位）。 */
@Component({
  selector: 'lib-step-wizard-summary',
  template: `
    <p class="sws-title">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1 5v7h2V7zm1 9a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z" />
      </svg>
      <span>{{ title() }}</span>
    </p>
    @if (detail()) {
      <p>{{ detail() }}</p>
    }
    @if (fields().length) {
      <ul>
        @for (field of fields(); track field.path) {
          <li>
            <button type="button" [attr.data-summary-field]="field.path" (click)="focusField.emit(field.path)">
              {{ field.label }}
            </button>
          </li>
        }
      </ul>
    }
  `,
  styleUrl: './step-wizard-summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'alert', tabindex: '-1', 'data-error-summary': '' },
})
export class StepWizardSummaryComponent {
  readonly title = input.required<string>();
  readonly detail = input('');
  readonly fields = input<readonly StepWizardFieldError[]>([]);
  readonly focusField = output<string>();
}

/** 錯誤圖示（圓形驚嘆號，同錯誤摘要）。 */
const ERROR_ICON = 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1 5v7h2V7zm1 9a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z';

/**
 * 窄版精簡列：「步驟 2／4 · 成員」、展開完整清單的按鈕、細進度條（裝飾）。
 * 目前這一步有錯時，狀態文字後面接「有錯誤」（圖示＋文字）；別的步驟有錯時，展開按鈕上加錯誤圖示，報讀器另外念「其他步驟需要修正」（stepListError）。
 */
@Component({
  selector: 'lib-step-wizard-compact',
  template: `
    <p class="swc-text">
      <span class="swc-status">{{ text() }}</span>
      @if (error()) {
        <span class="swc-error" data-compact-error>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path [attr.d]="errorIcon" /></svg>
          {{ error() }}
        </span>
      }
    </p>
    <button type="button" [attr.aria-expanded]="expanded()" [attr.aria-controls]="controls()" (click)="toggle.emit()">
      <span>{{ toggleLabel() }}</span>
      @if (listError()) {
        <svg class="swc-error" viewBox="0 0 24 24" aria-hidden="true" focusable="false" data-compact-list-error>
          <path [attr.d]="errorIcon" />
        </svg>
        <span class="swc-sr-only">{{ listError() }}</span>
      }
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7.4 9.3 12 13.9l4.6-4.6L18 10.7l-6 6-6-6z" /></svg>
    </button>
    <div class="swc-progress" aria-hidden="true"><span [style.inline-size.%]="progress()"></span></div>
  `,
  styleUrl: './step-wizard-compact.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepWizardCompactComponent {
  readonly text = input.required<string>();
  readonly toggleLabel = input.required<string>();
  /** 0–100。 */
  readonly progress = input(0);
  readonly expanded = input(false);
  /** 完整步驟清單的 id（aria-controls）。 */
  readonly controls = input('');
  /** 目前這一步有錯時顯示的文字（例：「有錯誤」）；空字串不顯示。 */
  readonly error = input('');
  /** 其他步驟有錯時，展開按鈕上給報讀器的文字；空字串不顯示圖示。 */
  readonly listError = input('');
  readonly toggle = output<void>();
  protected readonly errorIcon = ERROR_ICON;
}
