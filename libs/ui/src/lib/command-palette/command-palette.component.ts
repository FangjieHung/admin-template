import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { EmptyStateComponent } from '../feedback-state/empty-state.component';
import { isAbortError } from '../relation-select/relation-source';
import { COMMAND_PALETTE_LABELS, assertCommandPaletteLabels, formatCommandLabel } from './command-palette-labels';
import { CommandMatchSegment, commandMatchSegments, filterCommands, matchCommand } from './command-match';
import {
  CommandHistory,
  CommandItem,
  CommandProvider,
  RecentCommand,
  createMemoryCommandHistory,
} from './command-palette.types';
import { CommandOptionComponent } from './command-option.component';

/** 清單裡的一列（給內部的列元件與測試用）。 */
export interface CommandEntry {
  /** 來源 id＋項目 id。 */
  key: string;
  providerId: string;
  item: CommandItem;
  optionId: string;
  titleSegments: readonly CommandMatchSegment[];
  subtitleSegments: readonly CommandMatchSegment[];
}

type GroupStatus = 'ready' | 'loading' | 'error';

interface CommandGroupView {
  id: string;
  label: string;
  headingId: string;
  status: GroupStatus;
  entries: readonly CommandEntry[];
}

interface ProviderState {
  status: GroupStatus;
  items: readonly CommandItem[];
}

/** 兩段式動作打開的一層子清單。 */
interface CommandLevel {
  parent: CommandItem;
  /** 最上層那一列的來源（子項目記進最近使用時用它）。 */
  providerId: string;
  status: GroupStatus;
  items: readonly CommandItem[];
  /** 這一層的身分（載入完成時找回同一層；中途按了返回就不更新）。 */
  token: object;
}

function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
  return typeof (value as PromiseLike<T> | null)?.then === 'function';
}

let nextId = 0;

/**
 * 指令面板：一個搜尋框加上分組的結果清單（頁面、資料、動作），鍵盤就能跳頁、打開資料、執行動作。
 * 不負責浮層：放進 overlay（全域的 ⌘K）或直接嵌在頁面裡都可以；執行項目前送出 `(selected)`，由外層決定要不要關閉。
 *
 * 無障礙：輸入框是 combobox（`aria-activedescendant` 指向目前那一列），清單是 listbox，每一組是有標題的 group。
 * 鍵盤：上下鍵移動（頭尾相接），Home／End 到第一列／最後一列，Enter 執行，Esc 先清空查詢、再回上一層、最後送出 `(closed)`；
 * `mode="dialog"` 時 Tab 留在面板裡。滑鼠移動才會換目前那一列（清單捲動經過游標下方不算），不會把清單捲走。
 */
@Component({
  selector: 'lib-command-palette',
  imports: [EmptyStateComponent, CommandOptionComponent],
  templateUrl: './command-palette.component.html',
  styleUrl: './command-palette.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'lib-command-palette',
    '[attr.data-mode]': 'mode()',
    '(mousedown)': 'keepFocus($event)',
  },
})
export class CommandPaletteComponent {
  /** 結果來源，依陣列順序分組。 */
  readonly providers = input.required<readonly CommandProvider[]>();
  /** 最近使用存在哪裡；不給就只記在這個元件的記憶體裡。 */
  readonly history = input<CommandHistory | null>(null);
  /** 最近使用最多幾筆。 */
  readonly recentLimit = input(5);
  /** 非同步來源等使用者停手多久才搜尋（毫秒）。 */
  readonly debounceMs = input(150);
  /** `dialog`：放在對話框裡（Tab 留在面板、打開時聚焦）；`inline`：嵌在頁面裡（Tab 照常離開）。 */
  readonly mode = input<'dialog' | 'inline'>('inline');
  /** 目前的查詢，可以 `[(query)]`。 */
  readonly query = model('');

  /** 選了一個要執行的項目（`run()` 會緊接著被呼叫）；放在 overlay 時在這裡關閉面板。 */
  readonly selected = output<CommandItem>();
  /** 查詢已經是空的、也在最上層時又按了 Esc。 */
  readonly closed = output<void>();

  protected readonly labels = assertCommandPaletteLabels(inject(COMMAND_PALETTE_LABELS, { optional: true }));
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly inputRef = viewChild.required<ElementRef<HTMLInputElement>>('input');
  protected readonly idPrefix = `lib-cmdk-${nextId++}`;
  protected readonly listId = `${this.idPrefix}-list`;

  private readonly fallbackHistory = createMemoryCommandHistory();
  private readonly store = computed(() => this.history() ?? this.fallbackHistory);
  private readonly recents = signal<readonly RecentCommand[]>([]);
  private readonly states = signal<Readonly<Record<string, ProviderState>>>({});
  private readonly levels = signal<readonly CommandLevel[]>([]);
  private readonly activeKey = signal<string | null>(null);
  private readonly pending = new Map<string, { controller: AbortController; timer?: ReturnType<typeof setTimeout> }>();

  protected readonly level = computed(() => this.levels().at(-1) ?? null);

  protected readonly groups = computed<CommandGroupView[]>(() => {
    const query = this.query().trim();
    const level = this.level();
    const raw: { id: string; label: string; status: GroupStatus; items: { providerId: string; item: CommandItem }[] }[] = [];
    if (level) {
      const items = level.status === 'ready' ? filterCommands(query, level.items) : [];
      raw.push({ id: 'level', label: level.parent.title, status: level.status, items: items.map((item) => ({ providerId: level.providerId, item })) });
    } else if (!query) {
      const providers = this.providers().filter((p) => p.enabled?.() ?? true);
      const recent = this.recents()
        .map((r) => {
          const provider = providers.find((p) => p.id === r.providerId);
          const item = provider?.resolve?.(r) ?? null;
          return item ? { providerId: r.providerId, item } : null;
        })
        .filter((e): e is { providerId: string; item: CommandItem } => e !== null)
        .slice(0, this.recentLimit());
      if (recent.length) raw.push({ id: 'recent', label: this.labels.recent, status: 'ready', items: recent });
      const seen = new Set(recent.map((e) => `${e.providerId}:${e.item.id}`));
      for (const provider of providers) {
        const items = (provider.suggestions?.() ?? []).filter((item) => !seen.has(`${provider.id}:${item.id}`));
        if (items.length) raw.push({ id: provider.id, label: provider.label, status: 'ready', items: items.map((item) => ({ providerId: provider.id, item })) });
      }
    } else {
      const states = this.states();
      for (const provider of this.providers()) {
        const state = states[provider.id];
        if (!state || (state.status === 'ready' && state.items.length === 0)) continue;
        raw.push({ id: provider.id, label: provider.label, status: state.status, items: state.items.map((item) => ({ providerId: provider.id, item })) });
      }
    }
    let index = 0;
    return raw.map((group) => ({
      id: group.id,
      label: group.label,
      headingId: `${this.idPrefix}-g-${group.id}`,
      status: group.status,
      entries: group.items.map(({ providerId, item }) => {
        const match = matchCommand(query, item);
        return {
          key: `${group.id}:${providerId}:${item.id}`,
          providerId,
          item,
          optionId: `${this.idPrefix}-o${index++}`,
          titleSegments: commandMatchSegments(item.title, match?.title ?? []),
          subtitleSegments: commandMatchSegments(item.subtitle ?? '', match?.subtitle ?? []),
        };
      }),
    }));
  });

  protected readonly entries = computed(() => this.groups().flatMap((g) => g.entries));
  protected readonly activeEntry = computed(() => {
    const entries = this.entries();
    const key = this.activeKey();
    // 子清單一打開時停在目前使用中的那一項（例：目前的質地），否則停在第一列。
    return entries.find((e) => e.key === key) ?? (this.level() ? entries.find((e) => e.item.current) : null) ?? entries[0] ?? null;
  });
  private readonly busy = computed(() => this.groups().some((g) => g.status === 'loading'));
  protected readonly showEmpty = computed(
    () => !!this.query().trim() && this.entries().length === 0 && !this.busy() && !this.groups().some((g) => g.status === 'error'),
  );
  protected readonly noResultsText = computed(() => formatCommandLabel(this.labels.noResults, { query: this.query().trim() }));
  protected readonly placeholder = computed(() => {
    const level = this.level();
    return level ? formatCommandLabel(this.labels.subPlaceholder, { title: level.parent.title }) : this.labels.placeholder;
  });
  protected readonly backLabel = computed(() => formatCommandLabel(this.labels.back, { title: this.level()?.parent.title ?? '' }));
  /** 念給報讀器的結果數（還在搜尋時不念，免得一直插話）。 */
  protected readonly announcement = computed(() => {
    if (!this.query().trim() || this.busy()) return '';
    const count = this.entries().length;
    return count ? formatCommandLabel(this.labels.resultCount, { count }) : this.noResultsText();
  });

  constructor() {
    effect(() => {
      const store = this.store();
      untracked(() => this.recents.set(store.read()));
    });
    effect(() => {
      const query = this.query();
      const providers = this.providers();
      const inLevel = this.levels().length > 0;
      untracked(() => {
        this.activeKey.set(null);
        if (inLevel) this.cancelAll();
        else this.search(query.trim(), providers);
      });
    });
    inject(DestroyRef).onDestroy(() => this.cancelAll());
    afterNextRender(() => {
      if (this.mode() === 'dialog') this.focus();
    });
  }

  /** 把焦點放進搜尋框。 */
  focus(): void {
    this.inputRef().nativeElement.focus();
  }

  /** 回到最上層、清空查詢（例：overlay 重新打開時）。 */
  reset(): void {
    this.levels.set([]);
    this.query.set('');
    this.recents.set(this.store().read());
  }

  // ---- 事件 ----

  protected onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected onKeydown(event: KeyboardEvent): void {
    // 中文輸入法選字中的 Enter／方向鍵是給輸入法的。
    if (event.isComposing || event.keyCode === 229) return;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault();
        this.moveBy(event.key === 'ArrowDown' ? 1 : -1);
        return;
      case 'Home':
      case 'End': {
        const entries = this.entries();
        if (!entries.length) return;
        event.preventDefault();
        this.activate(entries[event.key === 'Home' ? 0 : entries.length - 1], true);
        return;
      }
      case 'Enter': {
        const entry = this.activeEntry();
        if (!entry) return;
        event.preventDefault();
        void this.execute(entry);
        return;
      }
      case 'Escape':
        event.preventDefault();
        if (this.query()) this.query.set('');
        else if (this.levels().length) this.back();
        else this.closed.emit();
        return;
      case 'Backspace':
        if (!this.query() && this.levels().length) {
          event.preventDefault();
          this.back();
        }
        return;
      case 'Tab':
        if (this.mode() === 'dialog') event.preventDefault();
        return;
    }
  }

  /** 點清單、麵包屑、空白處都不讓搜尋框失去焦點（鍵盤操作接得下去，Tab 也不會跑到背後的頁面）。 */
  protected keepFocus(event: MouseEvent): void {
    if (event.target !== this.inputRef().nativeElement) event.preventDefault();
  }

  /** 滑鼠真的移動了才換目前那一列（清單捲動時經過游標下方的列不會觸發 mousemove）。 */
  protected hover(entry: CommandEntry): void {
    if (this.activeEntry()?.key !== entry.key) this.activate(entry, false);
  }

  protected groupError(group: string): string {
    return formatCommandLabel(this.labels.groupError, { group });
  }

  protected back(): void {
    this.levels.update((levels) => levels.slice(0, -1));
    this.query.set('');
    this.focus();
  }

  protected async execute(entry: CommandEntry): Promise<void> {
    const { item } = entry;
    if (item.children) {
      this.enter(entry);
      return;
    }
    this.remember(entry);
    this.selected.emit(item);
    await item.run?.();
  }

  // ---- 內部 ----

  private moveBy(step: number): void {
    const entries = this.entries();
    if (!entries.length) return;
    const current = entries.indexOf(this.activeEntry()!);
    this.activate(entries[(current + step + entries.length) % entries.length], true);
  }

  private activate(entry: CommandEntry, scroll: boolean): void {
    this.activeKey.set(entry.key);
    if (scroll) this.scrollToActive();
  }

  /** 下一次繪製後把目前那一列捲進清單的可視範圍（鍵盤移動、子清單停在目前使用中的那一項）。 */
  private scrollToActive(): void {
    afterNextRender(
      () => {
        const id = this.activeEntry()?.optionId;
        if (id) this.host.nativeElement.querySelector<HTMLElement>(`#${id}`)?.scrollIntoView?.({ block: 'nearest' });
      },
      { injector: this.injector },
    );
  }

  private enter(entry: CommandEntry): void {
    const parent = entry.item;
    const providerId = this.levels()[0]?.providerId ?? entry.providerId;
    const token = {};
    this.levels.update((levels) => [...levels, { parent, providerId, status: 'loading', items: [], token }]);
    this.query.set('');
    this.focus();
    const settle = (patch: Pick<CommandLevel, 'status'> & Partial<CommandLevel>) => {
      this.levels.update((levels) => levels.map((l) => (l.token === token ? { ...l, ...patch } : l)));
      this.scrollToActive();
    };
    try {
      const result = parent.children!();
      if (isPromiseLike<readonly CommandItem[]>(result)) {
        result.then(
          (items) => settle({ status: 'ready', items }),
          () => settle({ status: 'error' }),
        );
      } else {
        settle({ status: 'ready', items: result });
      }
    } catch {
      settle({ status: 'error' });
    }
  }

  private remember(entry: CommandEntry): void {
    const providerId = this.levels()[0]?.providerId ?? entry.providerId;
    const provider = this.providers().find((p) => p.id === providerId);
    if (!provider?.resolve) return;
    const { item } = entry;
    const recent: RecentCommand = {
      providerId,
      id: item.id,
      title: item.title,
      kind: item.kind,
      ...(item.subtitle ? { subtitle: item.subtitle } : {}),
      ...(item.icon ? { icon: item.icon } : {}),
    };
    const next = [recent, ...this.recents().filter((r) => r.providerId !== providerId || r.id !== item.id)].slice(0, this.recentLimit());
    this.recents.set(next);
    this.store().write(next);
  }

  private search(query: string, providers: readonly CommandProvider[]): void {
    const next: Record<string, ProviderState> = {};
    for (const provider of providers) {
      this.cancel(provider.id);
      if (!query || query.length < (provider.minQueryLength ?? 1) || !(provider.enabled?.() ?? true)) continue;
      const limit = provider.limit ?? 5;
      if (provider.async) {
        next[provider.id] = { status: 'loading', items: [] };
        const controller = new AbortController();
        const timer = setTimeout(() => this.run(provider, query, controller, limit), this.debounceMs());
        this.pending.set(provider.id, { controller, timer });
        continue;
      }
      const controller = new AbortController();
      try {
        const result = provider.search(query, controller.signal);
        if (isPromiseLike<readonly CommandItem[]>(result)) {
          next[provider.id] = { status: 'loading', items: [] };
          this.pending.set(provider.id, { controller });
          this.await(provider.id, result, controller, limit);
        } else {
          next[provider.id] = { status: 'ready', items: result.slice(0, limit) };
        }
      } catch {
        next[provider.id] = { status: 'error', items: [] };
      }
    }
    this.states.set(next);
  }

  private run(provider: CommandProvider, query: string, controller: AbortController, limit: number): void {
    try {
      this.await(provider.id, Promise.resolve(provider.search(query, controller.signal)), controller, limit);
    } catch {
      this.patch(provider.id, { status: 'error', items: [] });
    }
  }

  private await(id: string, result: PromiseLike<readonly CommandItem[]>, controller: AbortController, limit: number): void {
    result.then(
      (items) => {
        if (!controller.signal.aborted) this.patch(id, { status: 'ready', items: items.slice(0, limit) });
      },
      (error: unknown) => {
        if (!controller.signal.aborted && !isAbortError(error)) this.patch(id, { status: 'error', items: [] });
      },
    );
  }

  private patch(id: string, state: ProviderState): void {
    this.pending.delete(id);
    this.states.update((states) => ({ ...states, [id]: state }));
  }

  private cancel(id: string): void {
    const pending = this.pending.get(id);
    if (!pending) return;
    clearTimeout(pending.timer);
    pending.controller.abort();
    this.pending.delete(id);
  }

  private cancelAll(): void {
    for (const id of [...this.pending.keys()]) this.cancel(id);
  }
}
