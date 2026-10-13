import { ChangeDetectionStrategy, Component, ElementRef, InjectionToken, computed, inject, input, output } from '@angular/core';
import {
  ACCESS_ACTIONS,
  AccessAction,
  AccessFeature,
  Permission,
  ToggleState,
  actionsOf,
  columnState,
  permissionOf,
  rowState,
  toggleColumn,
  togglePermission,
  toggleRow,
} from '../access.model';

/** 權限矩陣的畫面文字（libs/access 不內建字串）；`{feature}`、`{action}` 會被換掉。 */
export interface PermissionMatrixLabels {
  /** 第一欄的欄名，例：「功能」。 */
  feature: string;
  /** 每格勾選框的無障礙名稱，例：「{feature}：{action}」。 */
  cell: string;
  /** 列首的整列切換，例：「{feature}：全部動作」。 */
  toggleRow: string;
  /** 欄首的整欄切換，例：「所有功能：{action}」。 */
  toggleColumn: string;
  /** 唯讀時「有／沒有」的報讀文字。 */
  granted: string;
  notGranted: string;
  /** 這個功能沒有這個動作，例：「不適用」。 */
  notApplicable: string;
}

export const PERMISSION_MATRIX_LABELS = new InjectionToken<PermissionMatrixLabels>('PERMISSION_MATRIX_LABELS');

interface Cell {
  action: AccessAction;
  permission: Permission | null;
  checked: boolean;
}

interface Row {
  feature: AccessFeature;
  state: ToggleState;
  cells: Cell[];
}

/**
 * 角色的權限矩陣：功能是列、動作是欄，每格一個勾選框；列首與欄首的勾選框一次切換整列／整欄
 * （還沒全勾就全勾，已全勾就全取消，部分勾選時顯示半選）。
 *
 * 鍵盤：Tab 依序經過每個勾選框，空白鍵切換；方向鍵在格子之間上下左右移動（跳過不適用的格子）。
 * `readonly` 時改成「有／沒有」的圖示（預設角色、沒有編輯權限的人看）。
 */
@Component({
  selector: 'lib-permission-matrix',
  templateUrl: './permission-matrix.component.html',
  styleUrl: './permission-matrix.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'lib-permission-matrix', '(keydown)': 'onKeydown($event)' },
})
export class PermissionMatrixComponent {
  readonly features = input.required<readonly AccessFeature[]>();
  /** 五種動作的名稱（通常是 `AccessService.labels.actions`）。 */
  readonly actionLabels = input.required<Record<AccessAction, string>>();
  readonly value = input.required<readonly Permission[]>();
  readonly readonly = input(false);
  /** 表格標題（給報讀器），例：「主管的權限」。 */
  readonly caption = input('');

  /** 使用者勾選後的新權限清單（元件不保存狀態，由使用端決定什麼時候存）。 */
  readonly valueChange = output<Permission[]>();

  protected readonly labels = inject(PERMISSION_MATRIX_LABELS);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  /** 至少有一個功能用得到的動作才出現在欄位裡。 */
  protected readonly columns = computed(() =>
    ACCESS_ACTIONS.filter((a) => this.features().some((f) => actionsOf(f).includes(a))).map((action) => ({
      action,
      label: this.actionLabels()[action],
      state: columnState(this.value(), this.features(), action),
    })),
  );

  protected readonly rows = computed<Row[]>(() => {
    const granted = new Set(this.value());
    const cols = this.columns();
    return this.features().map((feature) => ({
      feature,
      state: rowState(this.value(), feature),
      cells: cols.map(({ action }) => {
        const permission = actionsOf(feature).includes(action) ? permissionOf(feature.id, action) : null;
        return { action, permission, checked: !!permission && granted.has(permission) };
      }),
    }));
  });

  protected fill(template: string, feature?: string, action?: string): string {
    return template.replace('{feature}', feature ?? '').replace('{action}', action ?? '');
  }

  protected onCell(permission: Permission, event: Event): void {
    this.valueChange.emit(togglePermission(this.value(), permission, (event.target as HTMLInputElement).checked));
  }

  protected onRow(feature: AccessFeature): void {
    this.valueChange.emit(toggleRow(this.value(), feature));
  }

  protected onColumn(action: AccessAction): void {
    this.valueChange.emit(toggleColumn(this.value(), this.features(), action));
  }

  /** 方向鍵在勾選框之間移動：同一欄往上下、同一列往左右，跳過沒有勾選框的格子。 */
  protected onKeydown(event: KeyboardEvent): void {
    const delta: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const move = delta[event.key];
    const target = event.target as HTMLElement;
    if (!move || !(target instanceof HTMLInputElement) || target.dataset['r'] === undefined) return;
    let r = Number(target.dataset['r']);
    let c = Number(target.dataset['c']);
    const maxR = this.rows().length;
    const maxC = this.columns().length;
    for (;;) {
      r += move[0];
      c += move[1];
      if (r < 0 || c < 0 || r > maxR || c > maxC) return;
      const next = this.host.querySelector<HTMLInputElement>(`input[data-r="${r}"][data-c="${c}"]`);
      if (next) {
        event.preventDefault();
        next.focus();
        return;
      }
    }
  }
}
