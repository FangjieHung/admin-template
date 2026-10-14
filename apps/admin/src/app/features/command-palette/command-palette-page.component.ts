import { Component, EnvironmentInjector, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { CommandItem, CommandPaletteComponent, CommandProvider, createMemoryCommandHistory } from '@admin-template/ui';
import { COMMAND_PALETTE_LABEL_PROVIDERS } from '../../shared/ui/command-palette-labels';
import { DemoBlockComponent } from '../../showcase/demo-block.component';
import { ApiSection, ShowcasePageComponent } from '../../showcase/showcase-page.component';
import { detailOf } from '../../showcase/showcase-catalog';
import { contactsProvider, demoActionsProvider, failingProvider, projectsProvider } from './demo-command-providers';

const ENTRY = detailOf('command-palette');

/** 指令面板展示頁（/components/command-palette）。 */
@Component({
  selector: 'app-command-palette-page',
  imports: [MatButtonModule, CommandPaletteComponent, ShowcasePageComponent, DemoBlockComponent],
  providers: [...COMMAND_PALETTE_LABEL_PROVIDERS],
  templateUrl: './command-palette-page.component.html',
  styleUrls: ['../../showcase/demo-shared.scss', './command-palette-page.component.scss'],
})
export class CommandPalettePageComponent {
  protected readonly entry = ENTRY;
  private readonly injector = inject(EnvironmentInjector);

  // ---- 示範 1：嵌在頁面裡（聯絡人同步、專案非同步、動作有兩段式） ----
  protected readonly inlineLog = signal('（還沒有執行任何項目）');
  private readonly logInline = (text: string) => this.inlineLog.set(text);
  protected readonly inlineProviders: readonly CommandProvider[] = [
    contactsProvider(this.logInline),
    projectsProvider(this.logInline),
    demoActionsProvider(this.logInline),
  ];
  protected readonly inlineHistory = createMemoryCommandHistory();
  protected readonly inlineQuery = signal('');
  protected readonly lastSelected = signal<CommandItem | null>(null);

  // ---- 示範 2：慢的與會失敗的來源 ----
  protected readonly statesLog = signal('（還沒有執行任何項目）');
  private readonly logStates = (text: string) => this.statesLog.set(text);
  protected readonly statesProviders: readonly CommandProvider[] = [
    contactsProvider(this.logStates),
    projectsProvider(this.logStates, 2500, '專案（慢速來源）'),
    failingProvider(),
  ];
  protected readonly statesQuery = signal('王');

  // ---- 示範 3：頁首的全域指令面板 ----
  protected openGlobal(): void {
    void import('../../layout/command-palette/command-palette-host').then((m) => m.toggleCommandPalette(this.injector, true));
  }

  protected readonly whenToUse = [
    '後台頁面多、選單層數深：知道要去哪一頁的人直接打字跳過去，不用一層層展開側欄。',
    '知道編號或名稱就想打開那一筆資料（「TK-2048」「官網改版」），不想先進列表再篩選。',
    '常用動作的快捷入口：新增一筆、切換外觀、切換身分、打開通知中心；兩段式動作（先選「切換質地」再選哪一個）讓清單不會一次塞滿。',
  ];
  protected readonly avoid = [
    '取代頁面本身的搜尋與篩選：列表頁要依條件篩選、排序、分頁時，用頁首工具列與進階篩選。',
    '唯一的入口：指令面板是給熟手的加速器，每個動作仍要在畫面上找得到按鈕。',
    '需要填很多欄位的動作：面板只負責「開始」（打開表單），不要在面板裡填表。',
  ];

  protected readonly usage = `// 頁面（或殼層 lazy 載入的對話框）的 providers：畫面文字（{query}、{title}、{group}、{count} 會被換掉）
providers: [{ provide: COMMAND_PALETTE_LABELS, useValue: ZH_TW_COMMAND_PALETTE }]

// 結果來源：依陣列順序分組。同步來源用內建的比對（開頭 > 字首 > 包含 > 依序出現）立刻顯示；
// 非同步來源（async: true）等使用者停手 150ms 才搜尋，換字時 signal 取消上一次，失敗只影響那一組
readonly providers: CommandProvider[] = [
  createStaticCommandProvider({ id: 'pages', label: '頁面', items: () => this.pages() }),
  {
    id: 'tickets', label: '工單', async: true, minQueryLength: 2,
    search: (query, signal) => this.api.searchTickets(query, { signal }),   // → CommandItem[]
    resolve: (recent) => ({ ...recent, run: () => this.router.navigateByUrl(\`/tickets/\${recent.id}\`) }),
  },
  createStaticCommandProvider({
    id: 'actions', label: '動作', items: () => this.actions(), suggestions: () => this.actions(),
  }),
];

// 一列：kind 決定預設圖示；children 是兩段式（先選「切換質地」再選哪一個）
{ id: 'texture', title: '切換質地', kind: 'action', children: () => textures.map(toItem) }

<lib-command-palette
  mode="dialog"                       // 放在對話框裡：打開時聚焦、Tab 留在面板
  [providers]="providers"
  [history]="createLocalStorageCommandHistory('app.commandPalette.recent')"
  (selected)="closeOverlay()"         // 先關閉（焦點回到按鈕），項目的 run() 接著執行
  (closed)="closeOverlay()"
/>

// 頁首的 ⌘K：按鈕與快捷鍵在 Initial bundle，對話框第一次打開才載入（layout/command-palette）
import('./command-palette-host').then((m) => m.toggleCommandPalette(injector));`;

  protected readonly api: ApiSection[] = [
    {
      title: 'lib-command-palette 輸入與輸出',
      rows: [
        { name: '[providers]', type: 'CommandProvider[]', default: '必填', description: '結果來源，依順序分組。查詢空白時列出最近使用與各來源的 suggestions()；有字時搜尋每個來源（不到 minQueryLength、enabled() 是 false 的跳過），沒有結果的組不顯示。' },
        { name: '[history]', type: 'CommandHistory | null', default: 'null（只記在記憶體）', description: '最近使用存在哪裡：read()／write()。createLocalStorageCommandHistory(key) 存在瀏覽器（讀寫失敗當作沒有紀錄），也可以換成伺服器的使用者偏好。' },
        { name: '[recentLimit]', type: 'number', default: '5', description: '最近使用最多幾筆。只記有 resolve() 的來源的項目，顯示前用 resolve() 換回（已經不存在或沒有權限的不顯示）。' },
        { name: '[debounceMs]', type: 'number', default: '150', description: '非同步來源等使用者停手多久才搜尋。' },
        { name: '[mode]', type: "'dialog' | 'inline'", default: "'inline'", description: 'dialog：打開時聚焦搜尋框，Tab 留在面板裡；inline：嵌在頁面裡，Tab 照常離開，搜尋框聚焦時下緣換成焦點色。' },
        { name: '[(query)]', type: 'string', default: "''", description: '目前的查詢。' },
        { name: '(selected)', type: 'CommandItem', description: '選了一個要執行的項目（兩段式的上層不算），項目的 run() 緊接著被呼叫；放在 overlay 時在這裡關閉。' },
        { name: '(closed)', type: 'void', description: '查詢已經是空的、也在最上層時又按了 Esc。' },
        { name: 'focus()／reset()', type: 'method', description: '把焦點放進搜尋框；回到最上層並清空查詢。' },
      ],
    },
    {
      title: 'CommandProvider 與 CommandItem',
      rows: [
        { name: 'search(query, signal)', type: 'CommandItem[] | Promise', description: '同步回傳陣列就立刻顯示；async: true 的來源回傳 Promise，等待時這一組顯示「搜尋中…」，reject 時只有這一組顯示錯誤（AbortError 安靜略過）。' },
        { name: 'label／limit／minQueryLength', type: 'string／number', default: '—／5／1', description: '分組標題、這一組最多幾筆、至少幾個字才搜尋。' },
        { name: 'enabled()／suggestions()／resolve(recent)', type: 'function', description: '能不能用（例：沒有權限整組不出現）；空白查詢時的建議；把最近使用換回可以執行的項目。' },
        { name: 'CommandItem', type: 'interface', description: "id、title、subtitle（也會被搜尋、標記）、icon、keywords（只用來搜尋）、shortcut（列尾的鍵帽）、kind（'page' | 'record' | 'action'）、current（列尾打勾）、children（兩段式）、run()。" },
        { name: 'createStaticCommandProvider(options)', type: 'CommandProvider', description: '固定清單的同步來源：items() 每次搜尋都會呼叫（清單隨權限、目前外觀改變），用 filterCommands 排序，resolve 預設依 id 找回。' },
        { name: 'filterCommands／matchCommand', type: 'function', description: '內建的比對：不分大小寫；整段相同 > 開頭 > 字首 > 包含 > 依序出現，標題 > 說明 > 關鍵字；有空白時每個詞都要對到。中文直接比對子字串。' },
        { name: 'COMMAND_PALETTE_LABELS', type: 'CommandPaletteLabels', default: '必填', description: '18 句畫面文字；少一句會在建立元件時丟出錯誤，列出缺的名稱。' },
      ],
    },
    {
      title: '鍵盤',
      rows: [
        { name: '⌘K／Ctrl+K、/', type: '頁首', description: '打開或關上全域指令面板；/ 只在焦點不在輸入欄位時有效。頁首的搜尋鈕寬螢幕顯示快捷鍵。' },
        { name: '↑ ↓／Home End', type: '面板', description: '在所有分組的結果之間移動（頭尾相接）；到第一列／最後一列。滑鼠移動也會換目前那一列，但不會捲動清單。' },
        { name: 'Enter', type: '面板', description: '執行目前那一列；兩段式的上層改成打開子清單（輸入框前面出現麵包屑）。中文輸入法選字中的 Enter 不算。' },
        { name: 'Esc／Backspace', type: '面板', description: 'Esc：有字先清空，在子清單裡回上一層，最上層才關閉。查詢空白時 Backspace 回上一層。觸控裝置與 600px 以下（滿版、沒有實體鍵盤）搜尋框旁邊多一個「取消」。' },
      ],
    },
  ];
}
