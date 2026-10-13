import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { RelationSelectComponent, ToastService, createArraySource } from '@admin-template/ui';
import { TOAST_PROVIDERS } from '../../shared/ui/component-label-providers';
import { RELATION_SELECT_LABEL_PROVIDERS } from '../../shared/ui/relation-select-labels';
import { DEMO_CONTACTS, DemoContact } from '../../showcase/demo-data';
import { DemoBlockComponent } from '../../showcase/demo-block.component';
import { ApiSection, ShowcasePageComponent } from '../../showcase/showcase-page.component';
import { detailOf } from '../../showcase/showcase-catalog';
import {
  DEMO_SLOW_MS,
  DemoNetwork,
  DemoRelationProject,
  DemoUser,
  makeDemoProjects,
  makeDemoUsers,
  nameInitials,
  withDemoLatency,
} from './relation-select-demo-data';

const ENTRY = detailOf('relation-select');

/** 關聯選擇欄位展示頁（/components/relation-select）：大量資料搜尋、初始值解析、建立新項目、各種狀態。 */
@Component({
  selector: 'app-relation-select-page',
  imports: [ReactiveFormsModule, MatSlideToggleModule, RelationSelectComponent, ShowcasePageComponent, DemoBlockComponent],
  providers: [...RELATION_SELECT_LABEL_PROVIDERS, ...TOAST_PROVIDERS],
  templateUrl: './relation-select-page.component.html',
  styleUrls: ['../../showcase/demo-shared.scss', './relation-select-page.component.scss'],
})
export class RelationSelectPageComponent {
  private readonly toast = inject(ToastService);
  protected readonly entry = ENTRY;
  protected readonly slowSeconds = DEMO_SLOW_MS / 1000;

  // ---- 模擬網路狀況（三個示範欄位共用） ----
  protected readonly simulateFailure = signal(false);
  protected readonly simulateSlow = signal(false);
  private readonly network: DemoNetwork = { fail: () => this.simulateFailure(), slow: () => this.simulateSlow() };

  // ---- 資料來源 ----
  protected readonly users = makeDemoUsers();
  protected readonly userSource = withDemoLatency(
    createArraySource(this.users, { idOf: (u) => u.id, textOf: (u) => u.name, secondaryOf: (u) => u.email }),
    this.network,
    { search: 300, getById: 300 },
  );
  protected readonly userName = (u: DemoUser) => u.name;
  protected readonly userEmail = (u: DemoUser) => u.email;
  protected readonly userInitials = (u: DemoUser) => nameInitials(u.name);

  protected readonly projects = makeDemoProjects();
  // getById 慢一點（600ms），看得到初始值解析中的骨架。
  protected readonly projectSource = withDemoLatency(
    createArraySource(this.projects, {
      idOf: (p) => p.id,
      textOf: (p) => p.name,
      secondaryOf: (p) => `${p.code} · ${p.owner}`,
    }),
    this.network,
    { search: 200, getById: 600 },
  );
  protected readonly projectName = (p: DemoRelationProject) => p.name;
  protected readonly projectMeta = (p: DemoRelationProject) => `${p.code} · 負責人 ${p.owner}`;

  private readonly contacts = signal<readonly DemoContact[]>(DEMO_CONTACTS);
  private createdCount = 0;
  protected readonly contactSource = withDemoLatency(
    createArraySource(() => this.contacts(), {
      idOf: (c) => c.id,
      textOf: (c) => c.name,
      secondaryOf: (c) => `${c.team} ${c.email}`,
    }),
    this.network,
    { search: 150, getById: 150 },
  );
  protected readonly contactName = (c: DemoContact) => c.name;
  protected readonly contactMeta = (c: DemoContact) => (c.email ? `${c.team} · ${c.email}` : c.team);
  protected readonly contactInitials = (c: DemoContact) => nameInitials(c.name);

  // ---- 表單 ----
  protected readonly form = new FormGroup({
    owner: new FormControl<string | null>(null),
    project: new FormControl<string | null>('prj-017'),
    contact: new FormControl<string | null>(null),
  });

  // ---- 狀態 ----
  protected readonly requiredControl = new FormControl<string | null>(null, Validators.required);
  protected readonly lastEvent = signal('（尚未操作）');

  constructor() {
    // 「必填未填」示範一進來就是碰過的狀態，直接看得到錯誤外觀。
    this.requiredControl.markAsTouched();
  }

  protected onUserSelected(user: DemoUser | null): void {
    this.lastEvent.set(user ? `selectionChange：${user.name}（${user.id}）` : 'selectionChange：null（已清除）');
  }

  protected onCreateContact(name: string): void {
    this.createdCount += 1;
    const contact: DemoContact = { id: `c-new-${this.createdCount}`, name, team: '新建立的聯絡人（示範）', email: '' };
    this.contacts.update((list) => [...list, contact]);
    this.form.controls.contact.setValue(contact.id);
    this.lastEvent.set(`createRequested：「${name}」→ 新 id ${contact.id}`);
    this.toast.success(`已建立「${name}」（示範）`);
  }

  protected readonly whenToUse = [
    '表單裡要從幾百到幾萬筆資料挑一筆：負責人、專案、聯絡人、上層分類。',
    '資料在伺服器、要邊打字邊查；表單只需要存 id。',
    '找不到時想讓使用者當場新增一筆（allowCreate）。',
  ];
  protected readonly avoid = [
    '選項在 10 筆以內、而且不會變：用 mat-select 或單選鈕。',
    '要一次挑很多筆：這一版只支援單選（多選規劃中）。',
    '自由輸入文字、只是給建議字：用一般的 matInput＋mat-autocomplete。',
  ];

  protected readonly usage = `// 頁面的 providers：畫面文字（{query}、{id} 會被換掉）
providers: [{ provide: RELATION_SELECT_LABELS, useValue: {
  loading: '載入中', empty: '沒有可選擇的項目', noResults: '找不到符合「{query}」的項目',
  hasMore: '還有更多，請輸入更多字縮小範圍', create: '建立「{query}」', searchFailed: '搜尋失敗',
  retry: '重試', clear: '清除', resolveFailed: '找不到這筆資料（{id}）',
} }]

// 接伺服器：search 收到的 signal 傳給 fetch，新搜尋會自動取消舊請求
readonly users: RelationSource<User> = {
  idOf: (u) => u.id,
  search: (q, signal) => fetch(\`/api/users?q=\${encodeURIComponent(q)}&limit=20\`, { signal }).then((r) => r.json()),
  getById: (id, signal) => fetch(\`/api/users/\${id}\`, { signal }).then((r) => (r.ok ? r.json() : null)),
};
// 小清單或假資料：createArraySource(list, { idOf, textOf, secondaryOf, limit: 20 })

<lib-relation-select
  label="負責人"
  formControlName="ownerId"
  [source]="users"
  [displayWith]="name"
  [secondaryWith]="email"
  [avatarWith]="initials"
  errorMessage="請選擇負責人"
  required
/>`;

  protected readonly api: ApiSection[] = [
    {
      title: '輸入',
      rows: [
        { name: '[source]', type: 'RelationSource<T>', default: '必填', description: '資料來源：search(query, signal)、getById(id, signal)、idOf(item)。' },
        { name: '[displayWith]', type: '(item: T) => string', default: '必填', description: '選項與輸入框顯示的主文字。' },
        { name: '[secondaryWith]', type: '(item: T) => string', default: 'null', description: '選項第二行的灰字（email、代碼）。' },
        { name: '[avatarWith]', type: '(item: T) => string', default: 'null', description: '選項前面縮寫圓章的文字。' },
        { name: '[label]／[placeholder]／[hint]', type: 'string', default: "''", description: '欄位標籤、提示字、欄位下方說明。' },
        { name: '[errorMessage]', type: 'string', default: "''", description: '驗證錯誤時欄位下方的文字。' },
        { name: '[required]', type: 'boolean', default: 'false', description: '標示必填；用 reactive forms 時另加 Validators.required（或直接寫 required 屬性）。' },
        { name: '[disabled]／[readonly]', type: 'boolean', default: 'false', description: '停用、唯讀：都不能搜尋，也沒有清除鈕。用表單時改呼叫 control.disable()。' },
        { name: '[allowCreate]', type: 'boolean', default: 'false', description: '輸入的字沒有完全相同的項目時，清單多一個「建立「xxx」」。' },
        { name: '[maxResults]', type: 'number', default: '20', description: '清單最多顯示幾筆；超過或 hasMore 時底部提示請輸入更多字。' },
        { name: '[appearance]', type: "'outline' | 'fill'", default: "'outline'", description: '欄位外觀，同 mat-form-field。' },
        { name: '[(value)]／formControlName', type: 'string | null', default: 'null', description: '選到的 id。初始帶 id 時用 getById 查出顯示文字。' },
      ],
    },
    {
      title: '輸出',
      rows: [
        { name: '(selectionChange)', type: 'T | null', description: '使用者選了一筆；按清除時是 null。用程式改值不會送出。' },
        { name: '(createRequested)', type: 'string', description: '按了「建立」，帶輸入的字。建立完成後把新 id 設回表單值即可。' },
      ],
    },
    {
      title: '注入與函式',
      rows: [
        { name: 'RELATION_SELECT_LABELS', type: 'RelationSelectLabels', default: '必填', description: '9 句畫面文字；少一句會在建立元件時丟出錯誤，列出缺的名稱。' },
        { name: 'createArraySource(items, options)', type: 'RelationSource<T>', description: '前端陣列做成的來源：不分大小寫比對主文字與第二行，回傳前 limit 筆與 hasMore；items 可給函式。' },
        { name: 'highlightSegments(text, query)', type: 'HighlightSegment[]', description: '把比對到的字切出來（元件內部用來加粗，也可以給其他清單用）。' },
      ],
    },
  ];
}
