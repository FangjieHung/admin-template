import { ChangeDetectionStrategy, Component, Injector, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { HasUnsavedChanges } from '@admin-template/access';
import { DataTableColumn, DataTableComponent, SplitPanelComponent, openConfirmDialog } from '@admin-template/ui';
import { ZH_TW } from '../../core/i18n/zh-tw';
import { ADMIN_DATA_TABLE_LABELS } from '../../shared/ui/data-table-labels';
import { CONFIRM_DIALOG_LABEL_PROVIDERS } from '../../shared/ui/component-label-providers';
import { DEMO_CONTACTS, DemoContact } from '../../showcase/demo-data';
import { DemoBlockComponent } from '../../showcase/demo-block.component';
import { ApiSection, ShowcasePageComponent } from '../../showcase/showcase-page.component';
import { detailOf } from '../../showcase/showcase-catalog';

const ENTRY = detailOf('split-panel');

/** 網址上記住「正在編輯哪一筆」的參數：`/components/split-panel?edit=c2`。只有這一頁讀寫它。 */
export const SPLIT_PANEL_EDIT_PARAM = 'edit';

/**
 * 分割檢視展示頁（/components/split-panel）：聯絡人清單，點一列在右側面板編輯，
 * 正在編輯的那一列在表格裡標成目前列；編輯哪一筆寫在網址（重新整理、上一頁都還原得回來）。
 */
@Component({
  selector: 'app-split-panel-page',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    DataTableComponent,
    SplitPanelComponent,
    ShowcasePageComponent,
    DemoBlockComponent,
  ],
  templateUrl: './split-panel-page.component.html',
  styleUrls: ['../../showcase/demo-shared.scss', './split-panel-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [...CONFIRM_DIALOG_LABEL_PROVIDERS],
})
export class SplitPanelPageComponent implements HasUnsavedChanges {
  protected readonly entry = ENTRY;
  protected readonly closeLabel = ZH_TW.common.closePanel;
  protected readonly tableLabels = ADMIN_DATA_TABLE_LABELS;

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);

  readonly contacts = signal<readonly DemoContact[]>(DEMO_CONTACTS);

  readonly columns: DataTableColumn<DemoContact>[] = [
    { key: 'name', label: '姓名', primary: true },
    { key: 'team', label: '部門', primary: true },
    { key: 'email', label: '電子郵件' },
  ];

  /** 網址上的 `?edit=`。 */
  readonly editId = toSignal(this.route.queryParamMap.pipe(map((params) => params.get(SPLIT_PANEL_EDIT_PARAM))), {
    initialValue: null,
  });

  /** 正在編輯的聯絡人；網址上的 id 找不到時是 null（面板關著）。 */
  readonly editing = computed(() => {
    const id = this.editId();
    return id ? (this.contacts().find((c) => c.id === id) ?? null) : null;
  });

  readonly lastSaved = signal<string | null>(null);

  private readonly fb = inject(NonNullableFormBuilder);
  readonly form = this.fb.group({
    name: ['', Validators.required],
    team: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
  });

  constructor() {
    // 換一筆就把表單換成那一筆的內容。
    effect(() => {
      const contact = this.editing();
      if (contact) this.form.reset({ name: contact.name, team: contact.team, email: contact.email });
    });
    // 網址帶了不存在的 id（已刪除、打錯）：靜靜拿掉參數，不留在歷史紀錄裡。
    effect(() => {
      if (this.editId() && !this.editing()) this.navigate(null, true);
    });
  }

  /** 表單跟開啟時那一筆的資料不一樣（改了又改回去不算）。 */
  hasUnsavedChanges(): boolean {
    const contact = this.editing();
    if (!contact) return false;
    const value = this.form.getRawValue();
    return value.name !== contact.name || value.team !== contact.team || value.email !== contact.email;
  }

  /**
   * 點一列：有未儲存的變更先問；面板已經開著時換一筆不新增歷史紀錄（上一頁直接回到關著的清單）。
   * 點的是正在編輯的那一列就什麼都不做。
   */
  openRow(contact: DemoContact): void {
    if (contact.id === this.editing()?.id) return;
    this.afterDiscardCheck(() => this.navigate(contact.id, this.editing() !== null));
  }

  /** 關閉鈕、Esc、窄螢幕的遮罩（lib-split-panel 的 closed）：有未儲存的變更先問。 */
  requestClose(): void {
    this.afterDiscardCheck(() => this.close());
  }

  /** 直接關閉：表單的「取消」鈕（明確放棄，不再問）與儲存之後。 */
  close(): void {
    this.navigate(null, false);
  }

  /** 離開這一頁（側欄、上一頁到別頁）前：路由的 unsavedChangesGuard 呼叫它。 */
  canLeave(): Promise<boolean> {
    return this.confirmDiscard();
  }

  private confirming: Promise<boolean> | null = null;

  /** 沒有未儲存的變更就馬上做；有的話等使用者選「放棄變更」才做，選「繼續編輯」什麼都不變。 */
  private afterDiscardCheck(action: () => void): void {
    if (!this.hasUnsavedChanges()) {
      action();
      return;
    }
    void this.confirmDiscard().then((discard) => {
      if (discard) action();
    });
  }

  /** 沒有未儲存的變更直接放行；有的話問一次（同時又被要求時共用同一個對話框，不疊兩個）。 */
  private confirmDiscard(): Promise<boolean> {
    if (!this.hasUnsavedChanges()) return Promise.resolve(true);
    if (!this.confirming) {
      const name = this.editing()?.name ?? '';
      this.confirming = openConfirmDialog(this.injector, {
        title: '放棄未儲存的變更？',
        message: `「${name}」的修改還沒儲存，換一筆或關閉面板的話，這些修改不會保留。`,
        confirmLabel: '放棄變更',
        cancelLabel: '繼續編輯',
      }).finally(() => (this.confirming = null));
    }
    return this.confirming;
  }

  save(): void {
    const contact = this.editing();
    if (!contact) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.contacts.update((list) => list.map((c) => (c.id === contact.id ? { ...c, ...value } : c)));
    this.lastSaved.set(value.name);
    this.close();
  }

  private navigate(id: string | null, replaceUrl: boolean): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [SPLIT_PANEL_EDIT_PARAM]: id },
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }

  protected readonly whenToUse = [
    '清單＋編輯：點一列在旁邊改，改完繼續點下一列，不用進出詳情頁。',
    '要一邊對照清單上其他筆資料、一邊看或改其中一筆。',
    '分享或重新整理後要回到同一筆：把正在開的 id 寫在網址上。',
  ];
  protected readonly avoid = [
    '欄位很多、要分段或有附件的表單：做成獨立的表單頁（工單表單樣板）。',
    '必須先處理完才能繼續的內容：用對話框。',
    '只是看詳情、不需要對照清單：用詳情頁版型。',
  ];

  protected readonly usage = `// 頁面：正在編輯哪一筆寫在網址（?edit=<id>），面板開關跟著網址走
readonly editId = toSignal(this.route.queryParamMap.pipe(map((p) => p.get('edit'))), { initialValue: null });
readonly editing = computed(() => this.contacts().find((c) => c.id === this.editId()) ?? null);

openRow(c: Contact) {          // 點一列；有未儲存的變更先問（openConfirmDialog）
  this.afterDiscardCheck(() => this.router.navigate([], { relativeTo: this.route,
    queryParams: { edit: c.id }, queryParamsHandling: 'merge', replaceUrl: this.editing() !== null }));
}
requestClose() { this.afterDiscardCheck(() => this.close()); }  // 關閉鈕、Esc、遮罩
canLeave() { return this.confirmDiscard(); }  // 側欄換頁：路由的 unsavedChangesGuard

<!-- 模板 -->
<lib-split-panel [open]="!!editing()" [heading]="'編輯 ' + editing()?.name"
                 closeLabel="關閉面板" (closed)="requestClose()">
  <div class="ui-card !p-0">
    <lib-data-table [columns]="columns" [rows]="contacts()" [labels]="labels"
      [rowClickable]="true" [activeRowId]="editing()?.id ?? null" (rowClick)="openRow($event)" />
  </div>
  <form splitPanelContent [formGroup]="form" (submit)="save(); $event.preventDefault()">…</form>
</lib-split-panel>`;

  protected readonly api: ApiSection[] = [
    {
      title: 'lib-split-panel 輸入與輸出',
      rows: [
        { name: '[open]', type: 'boolean', default: 'false', description: '面板是否開著；關著時清單占滿整個寬度。' },
        { name: '[heading]', type: 'string', default: "''", description: '面板標題（h2）；空字串時用 closeLabel 當無障礙名稱。' },
        { name: 'closeLabel', type: 'string', default: '必填', description: '關閉鈕與窄螢幕遮罩的無障礙名稱（元件不內建文字）。' },
        { name: '(closed)', type: 'void', description: '關閉的「請求」：按關閉鈕、按 Esc 或點窄螢幕的遮罩。元件不會自己關，由頁面決定——本頁有未儲存的變更時先問「放棄未儲存的變更？」，選「繼續編輯」就什麼都不變。Esc 已經被開著的對話框或下拉選單處理掉時不發出。' },
        { name: '預設內容投影', type: '—', description: '左欄：清單（通常是放在 .ui-card 裡的 lib-data-table）。' },
        { name: '[splitPanelContent]（內容投影）', type: '—', description: '右側面板的內容：詳情或編輯表單；內距由內容自己給。' },
        { name: '--lib-split-panel-width', type: 'CSS 變數', default: 'clamp(20rem, 30vw, 28rem)', description: '面板寬度。' },
        { name: '--lib-split-panel-sticky-top / -max-height', type: 'CSS 變數', default: '0px / calc(100dvh - 8rem)', description: '面板黏在捲動容器頂端的距離與最高高度（超過時面板內容自己捲動）。' },
      ],
    },
    {
      title: 'lib-data-table 的配合',
      rows: [
        { name: '[rowClickable]', type: 'boolean', default: 'false', description: '整列可點（滑鼠、Enter、Space），發出 (rowClick)。' },
        { name: '[activeRowId]', type: 'unknown', default: 'null', description: '目前開著的那一列（rowId 的值）：加上 aria-current="true"、底色 --dt-row-active-bg（預設 --app-state-selected）與左緣標記 --dt-row-active-mark；手機卡片版是卡片外框。跟多選無關。' },
      ],
    },
    {
      title: '行為',
      rows: [
        { name: '> 1280px', type: '—', description: '兩欄並排：面板是一張 .ui-card（外觀跟著質地），捲動清單時黏在上方；清單仍可操作，點別列直接換內容。' },
        { name: '≤ 1280px', type: '—', description: '面板蓋滿整個畫面、從右側滑入（role=dialog、aria-modal），焦點鎖在面板內，關閉後回到原本點的那一列。' },
        { name: '焦點', type: '—', description: '點一列打開時焦點移進面板、關閉後回到那一列；直接開帶 ?edit= 的網址時不搶焦點（沿用 responsive-panel）。' },
        { name: '未儲存的變更', type: '頁面', description: '本頁的作法（守門放在頁面，不是元件功能：換列是清單的事件，不經過面板）：表單跟那一筆不同時，點別列、關閉鈕、Esc、側欄換頁都先用 openConfirmDialog 問一次；表單的「取消」是明確放棄，不問。瀏覽器上一頁只改 ?edit 時不會問（同一個路由的 query 變化不跑 canDeactivate）。' },
        { name: '?edit=<id>', type: '網址', description: '本頁的作法（不是元件功能）：開第一筆新增一筆歷史紀錄、換一筆取代、關閉再新增一筆；id 找不到時自動拿掉參數。' },
      ],
    },
  ];
}
