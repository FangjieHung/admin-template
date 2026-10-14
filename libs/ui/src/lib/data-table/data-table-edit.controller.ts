import {
  EffectRef,
  Injector,
  Signal,
  Type,
  WritableSignal,
  afterNextRender,
  computed,
  effect,
  signal,
  untracked,
} from '@angular/core';
import { ToastService } from '../toast/toast.service';
import { isAbortError } from '../relation-select/relation-source';
import { DataTableCellEditorComponent } from './data-table-cell-editor.component';
import { DataTableEditChromeComponent } from './data-table-edit-chrome.component';
import { DataTableRowFormComponent } from './data-table-row-form.component';
import {
  editKeyOf,
  editorOf,
  formatEditValue,
  isCellEditable,
  isMultiCellPaste,
  parseClipboardGrid,
  parseEditText,
  readEditValue,
  sameEditValue,
  validateEditValue,
} from './data-table-editing';
import { formatLabel } from './data-table-query';
import type { DataTableEditorHostSpec } from './data-table-editor-host.directive';
import {
  DataTableBatchSaveFn,
  DataTableCellChange,
  DataTableCellSaveFn,
  DataTableColumn,
  DataTableEditMode,
  DataTableEditingLabels,
  DataTableEditor,
  DataTableKey,
} from './data-table.types';

/**
 * 表格內直接編輯的控制器（lazy chunk）：資料表有欄位設了 editor 時才用動態 import 載入，沒有編輯的表格不付任何成本。
 * 管：目前的格子（鍵盤方向鍵移動）、編輯中的格子、即時儲存的狀態、批次修改的草稿與錯誤、貼上、手機的整列表單、報讀器通知。
 * 資料表本身只把狀態畫出來（data-table.component.html 的 `ed` 分支）。
 */

/** 勾選欄在方向鍵導覽裡的 key（不會和欄位 key 撞名）。 */
export const DT_SELECT_KEY = '\u0000select';

/** 編輯器確定後要往哪裡走。 */
export type DataTableEditIntent = 'down' | 'up' | 'right' | 'left' | 'stay' | 'blur';

/** 交給編輯器元件（cell-editor／relation-editor）的內容。 */
export interface DataTableEditorContext {
  readonly editor: DataTableEditor<unknown>;
  /** cell：在儲存格裡（Enter／Tab／Esc 由編輯器送回控制器）；form：手機的整列表單（只回報值）。 */
  readonly mode: 'cell' | 'form';
  /** 無障礙名稱（欄位名稱＋這一列的識別）。 */
  readonly label: string;
  /** 表單模式給 `<label for>` 用。 */
  readonly inputId: string | null;
  /** 文字類編輯器的起始文字（打字開始編輯時就是那個字）。 */
  readonly text: string;
  /** 下拉、關聯、開關的起始值。 */
  readonly value: unknown;
  /** 打字開始編輯：游標放最後，不全選。 */
  readonly seeded: boolean;
  readonly align: 'start' | 'end';
  readonly labels: DataTableEditingLabels;
  /** 目前的錯誤訊息（顯示在編輯器下方，輸入框 aria-invalid）。 */
  readonly error: Signal<string | null>;
  /** 文字類：輸入的字；下拉：選項的值；關聯：id 或 null；開關：布林。 */
  commit(raw: unknown, intent: DataTableEditIntent): void;
  cancel(): void;
  /** 值改了（表單模式收集值；儲存格模式在出錯後即時重新檢查）。 */
  change(raw: unknown): void;
}

/** 手機整列表單的一個欄位。 */
export interface DataTableRowFormField {
  key: string;
  label: string;
  spec: DataTableEditorHostSpec;
}

export interface DataTableRowFormContext {
  title: string;
  fields: readonly DataTableRowFormField[];
  labels: DataTableEditingLabels;
  saving: Signal<boolean>;
  save(): void;
  cancel(): void;
}

/** 批次列與報讀器通知（lazy 的外框元件）。 */
export interface DataTableEditChromeContext {
  labels: Signal<DataTableEditingLabels>;
  mode: Signal<DataTableEditMode>;
  dirtyCount: Signal<number>;
  errorCount: Signal<number>;
  saving: Signal<boolean>;
  announcement: Signal<string>;
  discard(): void;
  saveAll(): void;
  nextError(): void;
}

/** 範本畫一格需要的狀態。 */
export interface DataTableEditCellState {
  editable: boolean;
  active: boolean;
  editing: boolean;
  dirty: boolean;
  error: string | null;
  status: 'saving' | 'saved' | null;
  tabindex: 0 | -1;
}

/** 資料表交給控制器的東西（data-table.component.ts 組好）。 */
export interface DataTableEditHost<T> {
  readonly element: HTMLElement;
  readonly injector: Injector;
  /** 畫面上的欄位（已套用欄位偏好）。 */
  readonly columns: Signal<readonly DataTableColumn<T>[]>;
  readonly rows: Signal<readonly T[]>;
  /** 排序後的全部資料（跳到下一個錯誤時換頁用）。 */
  readonly processedRows: Signal<readonly T[]>;
  /** 畫面上的資料列（這一頁）。 */
  readonly displayRows: Signal<readonly T[]>;
  readonly rowId: Signal<(row: T) => unknown>;
  readonly labels: Signal<DataTableEditingLabels>;
  readonly mode: Signal<DataTableEditMode>;
  readonly cellSave: Signal<DataTableCellSaveFn<T> | null>;
  readonly batchSave: Signal<DataTableBatchSaveFn<T> | null>;
  readonly selectable: Signal<boolean>;
  /** 手機卡片版：不做儲存格層級的編輯，改用整列表單。 */
  readonly formMode: Signal<boolean>;
  readonly pageable: Signal<boolean>;
  readonly pageSize: Signal<number>;
  goToPage(page: number): void;
  /** 這一列的識別文字（編輯器名稱、手機表單標題）。 */
  rowLabel(row: T): string;
  dirtyChange(dirty: boolean): void;
}

interface Patch {
  value: unknown;
  original: unknown;
  /** draft：批次修改未儲存；saving／saved：即時儲存。 */
  status: 'draft' | 'saving' | 'saved';
  /** 批次草稿的錯誤（轉換失敗或檢查不通過）。 */
  error: string | null;
}

interface Editing<T> {
  id: unknown;
  colKey: string;
  editKey: DataTableKey<T>;
  editor: DataTableEditor<T>;
  row: T;
  original: unknown;
  error: WritableSignal<string | null>;
  spec: DataTableEditorHostSpec;
}

interface ActiveCell {
  id: unknown;
  key: string;
}

type PatchMap = ReadonlyMap<unknown, ReadonlyMap<string, Patch>>;

const SAVED_FLASH_MS = 1500;
const UNDO_MS = 5000;

let nextFieldId = 0;

export class DataTableEditController<T> {
  private readonly toast: ToastService | null;
  private readonly effects: EffectRef[] = [];
  private readonly cleanups: (() => void)[] = [];
  private readonly aborts = new Map<string, AbortController>();
  private readonly flashTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private destroyed = false;
  /** 焦點在表格裡（資料列重排、換頁後要把焦點放回目前的格子）。 */
  private hasFocus = false;
  private announceFlip = false;

  readonly active = signal<ActiveCell | null>(null);
  readonly editing = signal<Editing<T> | null>(null);
  /** id → editKey → 修改（批次草稿或即時儲存中）。 */
  private readonly patches = signal<PatchMap>(new Map());
  /** 即時儲存回傳的那一列，rows 更新前先顯示它。 */
  private readonly overrides = signal<ReadonlyMap<unknown, T>>(new Map());
  /** 即時儲存失敗：id → 欄位 key → 訊息。 */
  private readonly failures = signal<ReadonlyMap<unknown, ReadonlyMap<string, string>>>(new Map());
  /** 剛存好（顯示打勾一下）：id → 欄位 key。 */
  private readonly flashes = signal<ReadonlyMap<unknown, ReadonlySet<string>>>(new Map());
  readonly formRowId = signal<unknown>(null);
  private readonly formOpen = signal(false);
  private readonly formSaving = signal(false);
  readonly announcement = signal('');
  readonly batchSaving = signal(false);

  readonly dirtyCount = computed(() => {
    let n = 0;
    for (const cells of this.patches().values()) for (const p of cells.values()) if (p.status === 'draft') n++;
    return n;
  });
  readonly dirty = computed(() => this.dirtyCount() > 0);

  /** 依畫面順序（排序後的列 × 欄位順序）列出所有有錯的草稿格。 */
  private readonly errorCells = computed(() => {
    const patches = this.patches();
    const list: { index: number; id: unknown; colKey: string }[] = [];
    if (!patches.size) return list;
    const rowId = this.host.rowId();
    const columns = this.host.columns();
    this.host.processedRows().forEach((row, index) => {
      const cells = patches.get(rowId(row));
      if (!cells) return;
      for (const col of columns) {
        const key = editKeyOf(col);
        if (key !== null && cells.get(key)?.error) list.push({ index, id: rowId(row), colKey: col.key });
      }
    });
    return list;
  });
  readonly errorCount = computed(() => this.errorCells().length);

  /** id → 畫面上要顯示的那一列（套用即時儲存的回傳與修改）。 */
  private readonly views = computed(() => {
    const patches = this.patches();
    const overrides = this.overrides();
    const map = new Map<unknown, T>();
    if (!patches.size && !overrides.size) return map;
    const rowId = this.host.rowId();
    for (const row of this.host.rows()) {
      const id = rowId(row);
      const base = overrides.get(id);
      const cells = patches.get(id);
      if (!base && !cells) continue;
      const view = { ...(base ?? row) } as Record<string, unknown>;
      if (cells) for (const [key, p] of cells) view[key] = p.value;
      map.set(id, view as T);
    }
    return map;
  });

  /** 方向鍵導覽的欄（勾選欄＋畫面上的欄位）。 */
  private readonly navKeys = computed(() => [
    ...(this.host.selectable() ? [DT_SELECT_KEY] : []),
    ...this.host.columns().map((c) => c.key),
  ]);

  /** 目前的格子；還沒選過或那一列已經不在畫面上時，是第一列的第一個欄位。 */
  private readonly current = computed<ActiveCell | null>(() => {
    const rows = this.host.displayRows();
    const keys = this.navKeys();
    if (!rows.length || !keys.length) return null;
    const rowId = this.host.rowId();
    const active = this.active();
    if (active && keys.includes(active.key) && rows.some((r) => rowId(r) === active.id)) return active;
    const firstData = this.host.columns()[0]?.key ?? keys[0];
    return { id: rowId(rows[0]), key: firstData };
  });

  readonly chromeSpec: DataTableEditorHostSpec;
  readonly editorSpec = computed(() => this.editing()?.spec ?? null);
  readonly formSpec = computed<DataTableEditorHostSpec | null>(() => {
    if (!this.formOpen() || !this.host.formMode()) return null;
    const id = this.formRowId();
    // 只跟著「開哪一列」重建：存檔途中 rows 更新時，表單裡打到一半的值不會被洗掉。
    return untracked(() => {
      const row = this.host.rows().find((r) => this.host.rowId()(r) === id);
      return row === undefined ? null : this.buildForm(row);
    });
  });

  constructor(private readonly host: DataTableEditHost<T>) {
    this.toast = host.injector.get(ToastService, null, { optional: true });
    this.chromeSpec = {
      component: DataTableEditChromeComponent as Type<unknown>,
      context: {
        labels: host.labels,
        mode: host.mode,
        dirtyCount: this.dirtyCount,
        errorCount: this.errorCount,
        saving: this.batchSaving,
        announcement: this.announcement,
        discard: () => this.discard(),
        saveAll: () => void this.saveAll(),
        nextError: () => this.nextError(),
      } satisfies DataTableEditChromeContext,
    };

    const injector = host.injector;
    // rows 換了（頁面存好後重新讀取、別人改了資料）：已存好的修改與回傳的列作廢，以新的 rows 為準。
    let lastRows = untracked(() => host.rows());
    this.effects.push(
      effect(
        () => {
          const rows = host.rows();
          if (rows === lastRows) return;
          lastRows = rows;
          untracked(() => this.dropSaved());
        },
        { injector },
      ),
    );
    // 資料列重排（排序、存好後重新讀取）或換頁時，DOM 搬動會讓焦點掉到 body：放回目前的格子。
    this.effects.push(
      effect(
        () => {
          host.displayRows();
          untracked(() => {
            const editing = this.editing();
            if (editing && !host.displayRows().some((r) => host.rowId()(r) === editing.id)) this.editing.set(null);
            if (this.hasFocus) this.focusCurrent(true);
          });
        },
        { injector },
      ),
    );
    this.effects.push(effect(() => host.dirtyChange(this.dirty()), { injector }));
    // 欄位換成有關聯欄時先把 relation-select 的編輯器載好（資料表載入控制器時已經先載過一次）。
    this.effects.push(
      effect(
        () => {
          if (host.columns().some((c) => editorOf(c)?.type === 'relation')) void preloadRelationEditor();
        },
        { injector },
      ),
    );
    // 換成桌機版時關掉手機表單。
    this.effects.push(
      effect(
        () => {
          if (!host.formMode()) untracked(() => this.formOpen.set(false));
          else untracked(() => this.editing.set(null));
        },
        { injector },
      ),
    );

    // 點在表格外面：焦點真的離開了，之後重排不要把它搶回來。
    const doc = host.element.ownerDocument;
    const onPointerDown = (e: Event) => {
      if (!host.element.contains(e.target as Node)) this.hasFocus = false;
    };
    doc.addEventListener('pointerdown', onPointerDown, true);
    this.cleanups.push(() => doc.removeEventListener('pointerdown', onPointerDown, true));
    // 重新整理或關閉分頁時，有未儲存的批次修改就讓瀏覽器問一次。
    const win = doc.defaultView;
    if (win) {
      const onBeforeUnload = (e: BeforeUnloadEvent) => {
        if (this.dirty()) e.preventDefault();
      };
      win.addEventListener('beforeunload', onBeforeUnload);
      this.cleanups.push(() => win.removeEventListener('beforeunload', onBeforeUnload));
    }
  }

  destroy(): void {
    this.destroyed = true;
    for (const ref of this.effects) ref.destroy();
    for (const fn of this.cleanups) fn();
    for (const ac of this.aborts.values()) ac.abort();
    for (const t of this.flashTimers.values()) clearTimeout(t);
    this.aborts.clear();
    this.flashTimers.clear();
  }

  // ---- 範本用 ----

  /** 這一列畫面上的樣子（套用修改）；dtCell 範本也拿到這一份。 */
  view(row: T): T {
    return this.views().get(this.host.rowId()(row)) ?? row;
  }

  cell(row: T, col: DataTableColumn<T>): DataTableEditCellState {
    const id = this.host.rowId()(row);
    const current = this.current();
    const active = !!current && current.id === id && current.key === col.key;
    const editing = this.editing();
    const key = editKeyOf(col);
    const patch = key === null ? undefined : this.patches().get(id)?.get(key);
    const failure = this.failures().get(id)?.get(col.key) ?? null;
    return {
      editable: !this.host.formMode() && isCellEditable(col, row),
      active,
      editing: !!editing && editing.id === id && editing.colKey === col.key,
      dirty: patch?.status === 'draft',
      error: patch?.status === 'draft' ? patch.error : failure,
      status: patch?.status === 'saving' ? 'saving' : this.flashes().get(id)?.has(col.key) ? 'saved' : null,
      tabindex: active ? 0 : -1,
    };
  }

  /** 勾選欄的 checkbox 也參與方向鍵導覽（同一個 tabindex 規則）。 */
  selectTabindex(row: T): 0 | -1 {
    const current = this.current();
    return current && current.key === DT_SELECT_KEY && current.id === this.host.rowId()(row) ? 0 : -1;
  }

  isFormRow(row: T): boolean {
    return this.formOpen() && this.formRowId() === this.host.rowId()(row);
  }

  // ---- 事件（data-table 範本轉過來）----

  /** 焦點進到某一格（點擊、Tab、程式聚焦）：那一格就是目前的格子。 */
  onFocusIn(event: FocusEvent): void {
    this.hasFocus = true;
    const target = event.target as HTMLElement;
    if (this.editing() || !target.hasAttribute?.('data-dt-col')) return;
    const pos = this.positionOf(target);
    if (!pos) return;
    const id = this.host.rowId()(pos.row);
    const active = this.active();
    if (!active || active.id !== id || active.key !== pos.key) this.active.set({ id, key: pos.key });
  }

  onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (next && !this.host.element.contains(next)) this.hasFocus = false;
  }

  /** 點一下格子：變成目前的格子（點到開關就切換、點到鉛筆就開始編輯）。 */
  onCellClick(row: T, col: DataTableColumn<T>, event: MouseEvent): void {
    if (this.host.formMode()) return;
    const target = event.target as HTMLElement;
    const id = this.host.rowId()(row);
    const editing = this.editing();
    if (editing && editing.id === id && editing.colKey === col.key) return;
    if (isCellEditable(col, row)) event.stopPropagation();
    if (editing) {
      // 即時儲存時值有錯，編輯器還開著：不能離開這一格，焦點放回編輯器並再念一次錯誤。
      this.host.element.querySelector<HTMLElement>('[data-dt-editor]')?.focus();
      const message = editing.error();
      if (message) this.announce(message);
      return;
    } // 可編輯的格子不觸發整列點擊（rowClickable）
    // 格子裡自己的按鈕、連結照常運作，只記下目前的格子。
    const interactive = target.closest('button, a, input, select, textarea, [contenteditable]');
    this.active.set({ id, key: col.key });
    if (interactive && !target.closest('.dt-switch')) return;
    if (target.closest('.dt-switch') && isCellEditable(col, row) && editorOf(col)?.type === 'toggle') {
      this.flip(row, col);
    } else if (target.closest('.dt-edit-icon') && isCellEditable(col, row)) {
      this.startEdit(row, col, null);
      return;
    }
    this.focusCurrent();
  }

  onCellDblClick(row: T, col: DataTableColumn<T>): void {
    if (this.host.formMode() || !isCellEditable(col, row)) return;
    if (editorOf(col)?.type === 'toggle') return; // 兩次點擊已經切換兩次
    this.startEdit(row, col, null);
  }

  onSelectFocus(row: T): void {
    this.active.set({ id: this.host.rowId()(row), key: DT_SELECT_KEY });
  }

  /** 表格上的 keydown：格子（td）或勾選框上才處理；編輯器自己處理 Enter／Tab／Esc。 */
  onKeydown(event: KeyboardEvent): void {
    if (this.host.formMode() || this.editing() || event.defaultPrevented) return;
    const target = event.target as HTMLElement;
    if (!target.hasAttribute('data-dt-col')) return;
    const pos = this.positionOf(target);
    if (!pos) return;
    const { row, key } = pos;
    const col = this.host.columns().find((c) => c.key === key) ?? null;
    const mod = event.ctrlKey || event.metaKey;

    const nav: Record<string, () => void> = {
      ArrowUp: () => this.move(-1, 0),
      ArrowDown: () => this.move(1, 0),
      ArrowLeft: () => this.move(0, -1),
      ArrowRight: () => this.move(0, 1),
      Home: () => (mod ? this.moveTo(0, 0) : this.moveTo(null, 0)),
      End: () => (mod ? this.moveTo(Infinity, Infinity) : this.moveTo(null, Infinity)),
      PageUp: () => this.move(-10, 0),
      PageDown: () => this.move(10, 0),
    };
    if (nav[event.key] && !event.altKey) {
      event.preventDefault();
      nav[event.key]();
      return;
    }
    if (!col || event.altKey || (mod && event.key !== 'F2')) return;
    const editor = editorOf(col);
    const editable = isCellEditable(col, row);

    if (event.key === 'Enter' || event.key === 'F2') {
      event.preventDefault();
      if (!editable) {
        if (editor) this.announce(this.host.labels().readOnly);
        return;
      }
      if (editor?.type === 'toggle') this.flip(row, col);
      else this.startEdit(row, col, null);
      return;
    }
    if (event.key === ' ') {
      event.preventDefault(); // 格子上的空白鍵不捲動頁面
      if (editable && editor?.type === 'toggle') this.flip(row, col);
      return;
    }
    if (!editable || !editor || editor.type === 'toggle') return;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      if (this.host.mode() === 'batch') this.setDraft(row, col, null, null);
      else this.startEdit(row, col, '');
      return;
    }
    // 打字開始編輯：那個字取代原本的內容（日期、下拉、關聯也開啟編輯器）。
    if (event.key.length === 1 && !event.isComposing) {
      event.preventDefault();
      this.startEdit(row, col, editor.type === 'date' ? null : event.key);
    }
  }

  /** 批次修改時，在目前的格子貼上從 Excel／試算表複製的一塊：往右、往下填，每格都檢查。 */
  onPaste(event: ClipboardEvent): void {
    if (this.host.formMode() || this.editing() || this.host.mode() !== 'batch') return;
    const target = event.target as HTMLElement;
    if (!target.hasAttribute('data-dt-col')) return;
    const text = event.clipboardData?.getData('text/plain') ?? '';
    if (!text) return;
    const pos = this.positionOf(target);
    if (!pos) return;
    event.preventDefault();
    void this.paste(pos.rowIndex, pos.key, text);
  }

  /** 也給程式與測試呼叫：從第 rowIndex 列（這一頁）、欄位 key 開始貼上。 */
  async paste(rowIndex: number, startKey: string, text: string): Promise<void> {
    const labels = this.host.labels();
    const grid = isMultiCellPaste(text) ? parseClipboardGrid(text) : [[text.replace(/\r?\n$/, '')]];
    const rows = this.host.displayRows();
    const columns = this.host.columns();
    const startCol = columns.findIndex((c) => c.key === startKey);
    if (startCol < 0) return;
    let skipped = 0;
    const jobs: Promise<{ row: T; col: DataTableColumn<T>; value: unknown; error: string | null } | null>[] = [];
    grid.forEach((line, r) => {
      line.forEach((cellText, c) => {
        const row = rows[rowIndex + r];
        const col = columns[startCol + c];
        if (row === undefined || col === undefined || !isCellEditable(col, row)) {
          skipped++;
          return;
        }
        jobs.push(this.parseForPaste(row, col, cellText, labels));
      });
    });
    const results = (await Promise.all(jobs)).filter((r) => r !== null);
    if (this.destroyed) return;
    let errors = 0;
    const next = clonePatches(this.patches());
    for (const { row, col, value, error } of results) {
      if (error) errors++;
      writeDraft(next, this.host.rowId()(row), editKeyOf(col)!, value, readEditValue(col, row), error);
    }
    this.patches.set(next);
    const parts = [formatLabel(labels.pasted, { count: results.length })];
    if (errors) parts.push(formatLabel(labels.pasteErrors, { count: errors }));
    if (skipped) parts.push(formatLabel(labels.pasteSkipped, { count: skipped }));
    this.announce(parts.join('，'));
  }

  // ---- 編輯 ----

  /** 開始編輯一格。seed：打字開始時的那個字（取代原本內容）；null＝保留原本的值。 */
  startEdit(row: T, col: DataTableColumn<T>, seed: string | null): void {
    const editor = editorOf(col);
    const editKey = editKeyOf(col);
    if (!editor || editKey === null || editor.type === 'toggle' || !isCellEditable(col, row)) return;
    if (editor.type === 'relation' && !relationEditor) {
      // 欄位是之後才換成關聯欄的：先下載 relation-select 的編輯器再開。
      void preloadRelationEditor().then(() => {
        if (!this.destroyed) this.startEdit(row, col, seed);
      });
      return;
    }
    const id = this.host.rowId()(row);
    const labels = this.host.labels();
    const view = this.view(row);
    const value = readEditValue(col, view);
    const error = signal<string | null>(null);
    // 批次修改裡已經有錯的格子，打開時直接顯示那個錯誤。
    const patch = this.patches().get(id)?.get(editKey);
    if (patch?.status === 'draft' && patch.error) error.set(patch.error);
    const context: DataTableEditorContext = {
      editor: editor as DataTableEditor<unknown>,
      mode: 'cell',
      label: this.editLabel(row, col),
      inputId: null,
      text: seed ?? formatEditValue(editor, value, labels),
      value,
      seeded: seed !== null,
      align: col.align ?? 'start',
      labels,
      error,
      // 只認這一次編輯：編輯器被移除時晚到的 blur 不會誤送到下一格。
      commit: (raw, intent) => {
        if (this.editing()?.spec.context === context) this.commitEditor(raw, intent);
      },
      cancel: () => {
        if (this.editing()?.spec.context === context) this.cancelEdit();
      },
      change: (raw) => {
        if (error()) error.set(this.check(editor, raw, row).error);
      },
    };
    this.active.set({ id, key: col.key });
    this.editing.set({
      id,
      colKey: col.key,
      editKey,
      editor,
      row,
      original: readEditValue(col, row),
      error,
      spec: { component: editorComponentFor(editor), context },
    });
  }

  cancelEdit(): void {
    if (!this.editing()) return;
    this.editing.set(null);
    this.focusCurrent();
  }

  /** 編輯器按了 Enter／Tab（或離開）。即時儲存時有錯就留在編輯狀態；批次修改時照樣記下並標成錯誤。 */
  commitEditor(raw: unknown, intent: DataTableEditIntent): void {
    const editing = this.editing();
    if (!editing) return;
    const { row, editor } = editing;
    const col = this.host.columns().find((c) => c.key === editing.colKey);
    if (!col) {
      this.editing.set(null);
      return;
    }
    const { value, error } = this.check(editor, raw, row);
    if (this.host.mode() === 'instant') {
      if (error) {
        editing.error.set(error);
        if (intent !== 'blur') this.announce(error);
        return;
      }
      this.editing.set(null);
      if (!sameEditValue(value, readEditValue(col, this.view(row)))) void this.save(row, col, value, true);
    } else {
      this.editing.set(null);
      this.setDraft(row, col, value, error);
      if (error && intent !== 'blur') this.announce(error);
    }
    if (intent === 'blur') return;
    if (intent === 'down') this.move(1, 0, true);
    else if (intent === 'up') this.move(-1, 0, true);
    else if (intent === 'right') this.move(0, 1, true);
    else if (intent === 'left') this.move(0, -1, true);
    else this.focusCurrent();
  }

  /** 開關：切換並存（即時）或記成草稿（批次）。 */
  flip(row: T, col: DataTableColumn<T>): void {
    const next = !readEditValue(col, this.view(row));
    const editor = editorOf(col)!;
    const error = validateEditValue(editor, next, row, this.host.labels());
    if (this.host.mode() === 'instant') {
      if (error) {
        this.announce(error);
        return;
      }
      void this.save(row, col, next, true);
    } else {
      this.setDraft(row, col, next, error);
    }
  }

  private check(editor: DataTableEditor<T>, raw: unknown, row: T): { value: unknown; error: string | null } {
    const labels = this.host.labels();
    let value = raw;
    if (typeof raw === 'string' && editor.type !== 'relation' && editor.type !== 'select') {
      const parsed = parseEditText(editor, raw, labels);
      if (!parsed.ok) return { value: raw, error: parsed.error };
      value = parsed.value;
    }
    if (editor.type === 'text' && typeof value === 'string' && !editor.parse) value = value.trim();
    return { value, error: validateEditValue(editor, value, row, labels) };
  }

  private setDraft(row: T, col: DataTableColumn<T>, value: unknown, error: string | null): void {
    const key = editKeyOf(col);
    if (key === null) return;
    const next = clonePatches(this.patches());
    writeDraft(next, this.host.rowId()(row), key, value, readEditValue(col, row), error);
    this.patches.set(next);
  }

  // ---- 即時儲存 ----

  private async save(row: T, col: DataTableColumn<T>, value: unknown, offerUndo: boolean): Promise<boolean> {
    const fn = this.host.cellSave();
    const key = editKeyOf(col);
    if (!fn || key === null) return false;
    const labels = this.host.labels();
    const id = this.host.rowId()(row);
    const cellKey = `${String(id)}\u0000${col.key}`;
    const previous = readEditValue(col, this.view(row));
    const original = readEditValue(col, row);
    this.aborts.get(cellKey)?.abort();
    const ac = new AbortController();
    this.aborts.set(cellKey, ac);
    this.setFailure(id, col.key, null);
    this.writePatch(id, key, { value, original, status: 'saving', error: null });
    try {
      const result = await fn(row, key, value, ac.signal);
      if (ac.signal.aborted || this.destroyed) return false;
      if (result) {
        const overrides = new Map(this.overrides());
        overrides.set(id, result);
        this.overrides.set(overrides);
      }
      this.writePatch(id, key, { value, original, status: 'saved', error: null });
      this.flash(id, col.key);
      const message = formatLabel(labels.saved, { column: col.label });
      this.announce(message);
      if (offerUndo && this.toast) {
        const ref = this.toast.success(message, { action: labels.undo, duration: UNDO_MS });
        void ref.actionClicked.then(async (undo) => {
          if (!undo || this.destroyed) return;
          const current = this.host.rows().find((r) => this.host.rowId()(r) === id) ?? row;
          if (await this.save(current, col, previous, false)) {
            this.toast?.info(formatLabel(labels.undone, { column: col.label }));
          }
        });
      }
      return true;
    } catch (error) {
      if (ac.signal.aborted || this.destroyed || isAbortError(error)) return false;
      this.removePatch(id, key);
      const message = typeof error === 'string' && error ? error : labels.saveFailed;
      this.setFailure(id, col.key, message);
      this.announce(`${formatLabel(labels.saveFailedToast, { column: col.label })}：${message}`);
      if (this.toast) {
        const ref = this.toast.error(formatLabel(labels.saveFailedToast, { column: col.label }), { action: labels.retry });
        void ref.actionClicked.then((retry) => {
          if (!retry || this.destroyed) return;
          const current = this.host.rows().find((r) => this.host.rowId()(r) === id) ?? row;
          void this.save(current, col, value, offerUndo);
        });
      }
      return false;
    } finally {
      if (this.aborts.get(cellKey) === ac) this.aborts.delete(cellKey);
    }
  }

  // ---- 批次儲存 ----

  /** 儲存全部：有錯時跳到第一個錯誤、不送出。回傳是否存好。 */
  async saveAll(): Promise<boolean> {
    const labels = this.host.labels();
    if (this.errorCount() > 0) {
      this.nextError(true);
      this.announce(formatLabel(labels.errorCount, { count: this.errorCount() }));
      return false;
    }
    const fn = this.host.batchSave();
    const changes = this.changes();
    if (!changes.length) return true;
    if (!fn || this.batchSaving()) return false;
    this.batchSaving.set(true);
    try {
      await fn(changes);
      if (this.destroyed) return true;
      const next = clonePatches(this.patches());
      for (const [id, cells] of next) {
        const updated = new Map(cells);
        for (const [key, p] of cells) if (p.status === 'draft') updated.set(key, { ...p, status: 'saved' });
        next.set(id, updated);
      }
      this.patches.set(next);
      const message = formatLabel(labels.batchSaved, { count: changes.length });
      this.announce(message);
      this.toast?.success(message);
      return true;
    } catch {
      if (this.destroyed) return false;
      this.announce(labels.batchSaveFailed);
      const ref = this.toast?.error(labels.batchSaveFailed, { action: labels.retry });
      void ref?.actionClicked.then((retry) => {
        if (retry && !this.destroyed) void this.saveAll();
      });
      return false;
    } finally {
      this.batchSaving.set(false);
    }
  }

  /** 捨棄所有批次修改。 */
  discard(): void {
    if (!this.dirty()) return;
    this.editing.set(null);
    const next = clonePatches(this.patches());
    for (const [id, cells] of next) {
      const kept = new Map([...cells].filter(([, p]) => p.status !== 'draft'));
      if (kept.size) next.set(id, kept);
      else next.delete(id);
    }
    this.patches.set(next);
    this.announce(this.host.labels().discarded);
  }

  /** 目前所有批次修改（依資料順序）。 */
  changes(): DataTableCellChange<T>[] {
    const rowId = this.host.rowId();
    const out: DataTableCellChange<T>[] = [];
    const patches = this.patches();
    for (const row of this.host.rows()) {
      const cells = patches.get(rowId(row));
      if (!cells) continue;
      for (const [key, p] of cells) {
        if (p.status === 'draft') out.push({ row, key: key as DataTableKey<T>, value: p.value, previous: p.original });
      }
    }
    return out;
  }

  /** 跳到下一個錯誤（目前的格子後面第一個，到底了從頭開始；需要時換頁）。 */
  nextError(fromStart = false): void {
    const errors = this.errorCells();
    if (!errors.length) return;
    const columns = this.host.columns();
    const order = (index: number, key: string) => index * (columns.length + 1) + columns.findIndex((c) => c.key === key);
    let after = -1;
    const current = this.active();
    if (current && !fromStart) {
      const index = this.host.processedRows().findIndex((r) => this.host.rowId()(r) === current.id);
      if (index >= 0) after = order(index, current.key);
    }
    const next = errors.find((e) => order(e.index, e.colKey) > after) ?? errors[0];
    if (this.host.pageable()) this.host.goToPage(Math.floor(next.index / Math.max(1, this.host.pageSize())));
    this.active.set({ id: next.id, key: next.colKey });
    this.focusCurrent(false, true);
  }

  // ---- 手機整列表單 ----

  openForm(row: T): void {
    this.formRowId.set(this.host.rowId()(row));
    this.formOpen.set(true);
    this.focusInHost('.dt-row-form input, .dt-row-form select, .dt-row-form .dt-row-form__field button');
  }

  closeForm(): void {
    const id = this.formRowId();
    this.formOpen.set(false);
    if (this.destroyed) return;
    afterNextRender(
      {
        write: () => {
          const index = this.host.displayRows().findIndex((r) => this.host.rowId()(r) === id);
          this.host.element.querySelector<HTMLElement>(`[data-dt-edit-row="${index}"]`)?.focus();
        },
      },
      { injector: this.host.injector },
    );
  }

  private buildForm(row: T): DataTableEditorHostSpec {
    const labels = this.host.labels();
    const view = this.view(row);
    const columns = this.host.columns().filter((c) => isCellEditable(c, row));
    const values = new Map<string, unknown>();
    const errors = new Map<string, WritableSignal<string | null>>();
    const fields: DataTableRowFormField[] = columns.map((col) => {
      const editor = editorOf(col)!;
      const value = readEditValue(col, view);
      const error = signal<string | null>(null);
      errors.set(col.key, error);
      const context: DataTableEditorContext = {
        editor: editor as DataTableEditor<unknown>,
        mode: 'form',
        label: col.label,
        inputId: `dt-row-form-${nextFieldId++}`,
        text: formatEditValue(editor, value, labels),
        value,
        seeded: false,
        align: 'start',
        labels,
        error,
        commit: () => void this.submitForm(row, columns, values, errors),
        cancel: () => this.closeForm(),
        change: (raw) => {
          values.set(col.key, raw);
          if (error()) error.set(this.check(editor, raw, row).error);
        },
      };
      return { key: col.key, label: col.label, spec: { component: editorComponentFor(editor), context } };
    });
    return {
      component: DataTableRowFormComponent as Type<unknown>,
      context: {
        title: formatLabel(labels.editRowLabel, { row: this.host.rowLabel(row) }),
        fields,
        labels,
        saving: this.formSaving,
        save: () => void this.submitForm(row, columns, values, errors),
        cancel: () => this.closeForm(),
      } satisfies DataTableRowFormContext,
    };
  }

  private async submitForm(
    row: T,
    columns: readonly DataTableColumn<T>[],
    values: Map<string, unknown>,
    errors: Map<string, WritableSignal<string | null>>,
  ): Promise<void> {
    if (this.formSaving()) return;
    const checked: { col: DataTableColumn<T>; value: unknown }[] = [];
    let firstError: string | null = null;
    for (const col of columns) {
      if (!values.has(col.key)) continue;
      const { value, error } = this.check(editorOf(col)!, values.get(col.key), row);
      errors.get(col.key)?.set(error);
      if (error) firstError ??= col.key;
      else if (!sameEditValue(value, readEditValue(col, this.view(row)))) checked.push({ col, value });
    }
    if (firstError !== null) {
      this.announce(errors.get(firstError)!()!);
      this.focusInHost('.dt-row-form [aria-invalid="true"]');
      return;
    }
    if (this.host.mode() === 'batch') {
      for (const { col, value } of checked) this.setDraft(row, col, value, null);
      this.closeForm();
      return;
    }
    this.formSaving.set(true);
    try {
      for (const { col, value } of checked) {
        if (!(await this.save(row, col, value, false))) return; // 失敗：表單留著，提示已顯示
      }
      if (checked.length) {
        const labels = this.host.labels();
        const message = formatLabel(labels.saved, { column: checked.map((c) => c.col.label).join('、') });
        this.toast?.success(message);
      }
      this.closeForm();
    } finally {
      this.formSaving.set(false);
    }
  }

  // ---- 導覽與焦點 ----

  private move(dRow: number, dCol: number, afterEdit = false): void {
    const current = this.current();
    if (!current) return;
    const rows = this.host.displayRows();
    const keys = this.navKeys();
    const rowId = this.host.rowId();
    let r = rows.findIndex((row) => rowId(row) === current.id);
    let c = keys.indexOf(current.key);
    if (afterEdit && dCol !== 0) {
      // Tab：走到列尾時換到下一列的第一個欄位（Shift+Tab 反過來），不進勾選欄。
      const first = keys[0] === DT_SELECT_KEY ? 1 : 0;
      c += dCol;
      if (c >= keys.length) {
        c = first;
        r = Math.min(rows.length - 1, r + 1);
      } else if (c < first) {
        c = keys.length - 1;
        r = Math.max(0, r - 1);
      }
    } else {
      r = clamp(r + dRow, 0, rows.length - 1);
      c = clamp(c + dCol, 0, keys.length - 1);
    }
    this.active.set({ id: rowId(rows[r]), key: keys[c] });
    this.focusCurrent();
  }

  private moveTo(rowIndex: number | null, colIndex: number): void {
    const current = this.current();
    const rows = this.host.displayRows();
    const keys = this.navKeys();
    if (!current || !rows.length) return;
    const rowId = this.host.rowId();
    const r = rowIndex === null ? rows.findIndex((row) => rowId(row) === current.id) : clamp(rowIndex, 0, rows.length - 1);
    const c = clamp(colIndex, 0, keys.length - 1);
    this.active.set({ id: rowId(rows[r]), key: keys[c] });
    this.focusCurrent();
  }

  /** 下一次畫面更新後把焦點放到目前的格子。onlyIfLost：只有焦點掉到 body 時才放（重排後復原）。 */
  private focusCurrent(onlyIfLost = false, scroll = false): void {
    if (this.destroyed) return;
    afterNextRender(
      {
        write: () => {
          if (this.destroyed || this.editing()) return;
          const doc = this.host.element.ownerDocument;
          const lost = !doc.activeElement || doc.activeElement === doc.body;
          if (onlyIfLost && !lost) return;
          const el = this.currentElement();
          if (!el) return;
          if (scroll) el.scrollIntoView?.({ block: 'center', inline: 'nearest' });
          el.focus({ preventScroll: !scroll });
          if (!scroll) el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
          this.hasFocus = true;
        },
      },
      { injector: this.host.injector },
    );
  }

  private currentElement(): HTMLElement | null {
    const current = this.current();
    if (!current) return null;
    const rowId = this.host.rowId();
    const index = this.host.displayRows().findIndex((r) => rowId(r) === current.id);
    if (index < 0) return null;
    const candidates = this.host.element.querySelectorAll<HTMLElement>(`[data-dt-row="${index}"]`);
    return [...candidates].find((el) => el.getAttribute('data-dt-col') === current.key) ?? null;
  }

  private positionOf(el: HTMLElement): { row: T; rowIndex: number; key: string } | null {
    const rowIndex = Number(el.getAttribute('data-dt-row'));
    const key = el.getAttribute('data-dt-col');
    const row = this.host.displayRows()[rowIndex];
    return row === undefined || key === null ? null : { row, rowIndex, key };
  }

  private focusInHost(selector: string): void {
    if (this.destroyed) return;
    afterNextRender(
      { write: () => this.host.element.querySelector<HTMLElement>(selector)?.focus() },
      { injector: this.host.injector },
    );
  }

  private editLabel(row: T, col: DataTableColumn<T>): string {
    return formatLabel(this.host.labels().editCell, { row: this.host.rowLabel(row), column: col.label });
  }

  private async parseForPaste(
    row: T,
    col: DataTableColumn<T>,
    text: string,
    labels: DataTableEditingLabels,
  ): Promise<{ row: T; col: DataTableColumn<T>; value: unknown; error: string | null } | null> {
    const editor = editorOf(col)!;
    if (editor.type === 'relation') {
      const query = text.trim();
      if (!query) return { row, col, value: null, error: validateEditValue(editor, null, row, labels) };
      try {
        const page = await editor.source.search(query, new AbortController().signal);
        const key = query.toLocaleLowerCase();
        const item = page.items.find(
          (i) => editor.displayWith(i).toLocaleLowerCase() === key || editor.source.idOf(i).toLocaleLowerCase() === key,
        );
        if (item === undefined) return { row, col, value: query, error: formatLabel(labels.notFound, { text: query }) };
        const value = editor.source.idOf(item);
        return { row, col, value, error: validateEditValue(editor, value, row, labels) };
      } catch {
        return { row, col, value: query, error: formatLabel(labels.notFound, { text: query }) };
      }
    }
    const parsed = parseEditText(editor, text, labels);
    if (!parsed.ok) return { row, col, value: text, error: parsed.error };
    const value = editor.type === 'text' && typeof parsed.value === 'string' ? parsed.value.trim() : parsed.value;
    return { row, col, value, error: validateEditValue(editor, value, row, labels) };
  }

  // ---- 狀態小工具 ----

  private writePatch(id: unknown, key: string, patch: Patch): void {
    const next = clonePatches(this.patches());
    const cells = new Map(next.get(id) ?? []);
    cells.set(key, patch);
    next.set(id, cells);
    this.patches.set(next);
  }

  private removePatch(id: unknown, key: string): void {
    const cells = this.patches().get(id);
    if (!cells?.has(key)) return;
    const next = clonePatches(this.patches());
    const updated = new Map(cells);
    updated.delete(key);
    if (updated.size) next.set(id, updated);
    else next.delete(id);
    this.patches.set(next);
  }

  /** rows 換了：已存好的修改與回傳的列不再需要（草稿與儲存中的保留）。 */
  private dropSaved(): void {
    if (this.overrides().size) this.overrides.set(new Map());
    const patches = this.patches();
    let changed = false;
    const next = new Map<unknown, ReadonlyMap<string, Patch>>();
    for (const [id, cells] of patches) {
      const kept = new Map([...cells].filter(([, p]) => p.status !== 'saved'));
      if (kept.size !== cells.size) changed = true;
      if (kept.size) next.set(id, kept);
    }
    if (changed) this.patches.set(next);
  }

  private setFailure(id: unknown, colKey: string, message: string | null): void {
    const current = this.failures().get(id);
    if (!message && !current?.has(colKey)) return;
    const next = new Map(this.failures());
    const cells = new Map(current ?? []);
    if (message) cells.set(colKey, message);
    else cells.delete(colKey);
    if (cells.size) next.set(id, cells);
    else next.delete(id);
    this.failures.set(next);
  }

  private flash(id: unknown, colKey: string): void {
    const timerKey = `${String(id)}\u0000${colKey}`;
    clearTimeout(this.flashTimers.get(timerKey));
    const add = new Map(this.flashes());
    add.set(id, new Set([...(add.get(id) ?? []), colKey]));
    this.flashes.set(add);
    this.flashTimers.set(
      timerKey,
      setTimeout(() => {
        this.flashTimers.delete(timerKey);
        const next = new Map(this.flashes());
        const cells = new Set(next.get(id) ?? []);
        cells.delete(colKey);
        if (cells.size) next.set(id, cells);
        else next.delete(id);
        this.flashes.set(next);
      }, SAVED_FLASH_MS),
    );
  }

  /** 報讀器通知（aria-live）。同一句話連續出現也會再念一次。 */
  announce(message: string): void {
    this.announceFlip = !this.announceFlip;
    this.announcement.set(this.announceFlip ? message : `${message}\u00a0`);
  }
}

/** 關聯欄用 relation-select（另一個 lazy chunk，只有真的開啟關聯編輯器時才下載）。 */
let relationEditor: Type<unknown> | null = null;
let relationEditorLoading: Promise<Type<unknown>> | null = null;

/** 有關聯欄的表格先把 relation-select 的編輯器載好，開啟時就不必等。 */
export function preloadRelationEditor(): Promise<Type<unknown>> {
  relationEditorLoading ??= import('./data-table-relation-editor.component').then((m) => {
    relationEditor = m.DataTableRelationEditorComponent as Type<unknown>;
    return relationEditor;
  });
  return relationEditorLoading;
}

function editorComponentFor<T>(editor: DataTableEditor<T>): Type<unknown> {
  if (editor.type === 'relation') {
    if (!relationEditor) throw new Error('DataTable：關聯欄的編輯器還沒載入（preloadRelationEditor）');
    return relationEditor;
  }
  return DataTableCellEditorComponent as Type<unknown>;
}

function clonePatches(patches: PatchMap): Map<unknown, ReadonlyMap<string, Patch>> {
  return new Map(patches);
}

/** 寫一格批次草稿；值改回原本的樣子時拿掉（不算修改）。 */
function writeDraft(
  patches: Map<unknown, ReadonlyMap<string, Patch>>,
  id: unknown,
  key: string,
  value: unknown,
  original: unknown,
  error: string | null,
): void {
  const cells = new Map(patches.get(id) ?? []);
  if (!error && sameEditValue(value, original)) cells.delete(key);
  else cells.set(key, { value, original, status: 'draft', error });
  if (cells.size) patches.set(id, cells);
  else patches.delete(id);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}
