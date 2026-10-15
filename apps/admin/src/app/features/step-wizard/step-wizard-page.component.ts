import { Component, Injector, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import {
  DescriptionItem,
  DescriptionListComponent,
  EmptyStateComponent,
  RelationSelectComponent,
  StepWizardComponent,
  WizardStepComponent,
  createArraySource,
  openConfirmDialog,
} from '@admin-template/ui';
import { CONFIRM_DIALOG_LABEL_PROVIDERS } from '../../shared/ui/component-label-providers';
import { DESCRIPTION_LIST_LABEL_PROVIDERS } from '../../shared/ui/detail-labels';
import { RELATION_SELECT_LABEL_PROVIDERS } from '../../shared/ui/relation-select-labels';
import { STEP_WIZARD_LABEL_PROVIDERS } from '../../shared/ui/step-wizard-labels';
import { DEMO_CONTACTS, DemoContact } from '../../showcase/demo-data';
import { DemoBlockComponent } from '../../showcase/demo-block.component';
import { ApiSection, ShowcasePageComponent } from '../../showcase/showcase-page.component';
import { detailOf } from '../../showcase/showcase-catalog';

const ENTRY = detailOf('step-wizard');

/** 新增專案精靈的草稿存在分頁的 sessionStorage：重新整理後留在同一步、已填的值還在（示範用，關掉分頁就沒了）。 */
const DRAFT_KEY = 'admin-template.step-wizard.project-draft';

const VISIBILITY_LABELS: Record<string, string> = { team: '團隊內', private: '只有成員', org: '全公司' };
const ROLE_LABELS: Record<string, string> = { viewer: '檢視者', member: '成員', manager: '主管' };
const CATEGORY_LABELS: Record<string, string> = { bug: '功能異常', account: '帳號與權限', other: '其他' };

/** 假的送出：等一下再成功。 */
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** 步驟精靈展示頁（/components/step-wizard）。 */
@Component({
  selector: 'app-step-wizard-page',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    StepWizardComponent,
    WizardStepComponent,
    DescriptionListComponent,
    EmptyStateComponent,
    RelationSelectComponent,
    ShowcasePageComponent,
    DemoBlockComponent,
  ],
  providers: [
    ...STEP_WIZARD_LABEL_PROVIDERS,
    ...DESCRIPTION_LIST_LABEL_PROVIDERS,
    ...RELATION_SELECT_LABEL_PROVIDERS,
    ...CONFIRM_DIALOG_LABEL_PROVIDERS,
  ],
  templateUrl: './step-wizard-page.component.html',
  styleUrls: ['../../showcase/demo-shared.scss', './step-wizard-page.component.scss'],
})
export class StepWizardPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  protected readonly entry = ENTRY;

  // ---- 示範 1：新增專案（線性、?step= 同步、取消前確認、完成畫面） ----
  protected readonly project = new FormGroup({
    basics: new FormGroup({
      name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(40)] }),
      code: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(/^[A-Z][A-Z0-9]{1,5}$/)],
      }),
      description: new FormControl('', { nonNullable: true }),
    }),
    members: new FormGroup({
      owner: new FormControl<string | null>(null),
      notifyMembers: new FormControl(true, { nonNullable: true }),
    }),
    settings: new FormGroup({
      visibility: new FormControl<string | null>(null, Validators.required),
      dueDate: new FormControl('', { nonNullable: true }),
    }),
  });
  protected readonly basicsLabels = { name: '專案名稱', code: '專案代碼' };
  protected readonly settingsLabels = { visibility: '誰看得到' };
  protected readonly visibilityOptions = Object.entries(VISIBILITY_LABELS);
  protected readonly contactSource = createArraySource(DEMO_CONTACTS, {
    idOf: (c) => c.id,
    textOf: (c) => c.name,
    secondaryOf: (c) => `${c.team} ${c.email}`,
  });
  protected readonly contactName = (c: DemoContact) => c.name;
  protected readonly contactMeta = (c: DemoContact) => `${c.team} · ${c.email}`;

  private readonly projectWizard = viewChild<StepWizardComponent>('projectWizard');
  /** 目前在第幾步（0 起算），跟網址的 `?step=`（1 起算）同步。 */
  protected readonly projectStep = signal(0);
  /** 建立完成的專案名稱；有值時顯示完成畫面。 */
  protected readonly created = signal<string | null>(null);
  private readonly projectValue = toSignal(this.project.valueChanges, { initialValue: this.project.getRawValue() });

  protected readonly summaryItems = computed<DescriptionItem[]>(() => {
    const v = this.projectValue();
    const owner = DEMO_CONTACTS.find((c) => c.id === v.members?.owner)?.name ?? null;
    return [
      { label: '專案名稱', value: v.basics?.name ?? null },
      { label: '專案代碼', value: v.basics?.code ?? null },
      { label: '說明', value: v.basics?.description ?? null },
      { label: '負責人', value: owner },
      { label: '通知成員', value: v.members?.notifyMembers ? '建立後寄出邀請' : '不通知' },
      { label: '誰看得到', value: v.settings?.visibility ? VISIBILITY_LABELS[v.settings.visibility] : null },
      { label: '預計完成日', value: v.settings?.dueDate || null },
    ];
  });

  // ---- 示範 2：錯誤狀態 ----
  protected readonly contact = new FormGroup({
    name: new FormControl('陳怡君', { nonNullable: true, validators: Validators.required }),
    email: new FormControl('yijun.chen@', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    phone: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^0\d{1,2}-?\d{6,8}$/)] }),
  });
  protected readonly contactLabels = { name: '姓名', email: 'Email', phone: '電話' };
  protected readonly contactEvent = signal('（尚未送出）');

  // ---- 示範 3：非線性＋直式 ----
  protected readonly settings = new FormGroup({
    general: new FormGroup({
      name: new FormControl('客服系統導入', { nonNullable: true, validators: Validators.required }),
      code: new FormControl('CS', { nonNullable: true, validators: Validators.required }),
    }),
    notify: new FormGroup({
      onCreate: new FormControl(true, { nonNullable: true }),
      onDue: new FormControl(true, { nonNullable: true }),
      weekly: new FormControl(false, { nonNullable: true }),
    }),
    access: new FormGroup({
      defaultRole: new FormControl('member', { nonNullable: true, validators: Validators.required }),
    }),
    advanced: new FormGroup({
      archived: new FormControl(false, { nonNullable: true }),
    }),
  });
  protected readonly roleOptions = Object.entries(ROLE_LABELS);
  protected readonly settingsEvent = signal('（尚未儲存）');
  protected readonly saveSettings = () =>
    wait(900).then(() => this.settingsEvent.set(`已儲存「${this.settings.controls.general.controls.name.value}」的設定（示範）`));

  // ---- 示範 4：窄容器 ----
  protected readonly report = new FormGroup({
    describe: new FormGroup({
      summary: new FormControl('', { nonNullable: true, validators: Validators.required }),
    }),
    category: new FormGroup({
      category: new FormControl<string | null>(null, Validators.required),
    }),
    attach: new FormGroup({
      link: new FormControl('', { nonNullable: true }),
    }),
  });
  protected readonly categoryOptions = Object.entries(CATEGORY_LABELS);
  protected readonly reportEvent = signal('（尚未送出）');

  constructor() {
    this.restoreDraft();
    this.projectStep.set(this.clampProjectStep(this.route.snapshot.queryParamMap.get('step')));
    // 瀏覽器的上一頁／下一頁改了 ?step= 時跟著換步驟（往後跳時精靈仍會檢查前面的步驟）。
    this.route.queryParamMap
      .pipe(takeUntilDestroyed())
      .subscribe((params) => this.projectStep.set(this.clampProjectStep(params.get('step'))));
    this.project.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.saveDraft());
  }

  /** 換步驟：寫進網址（push，瀏覽器的上一頁會回到上一步）。 */
  protected onProjectStep(index: number): void {
    const step = index + 1;
    if (this.route.snapshot.queryParamMap.get('step') === String(step)) return;
    void this.router.navigate([], { relativeTo: this.route, queryParams: { step }, queryParamsHandling: 'merge' });
  }

  /** 假的送出（1.2 秒）；成功後顯示完成畫面、清掉草稿與 ?step=。 */
  protected readonly createProject = () =>
    wait(1200).then(() => {
      this.created.set(this.project.controls.basics.controls.name.value);
      this.clearDraft();
      void this.router.navigate([], { relativeTo: this.route, queryParams: { step: null }, queryParamsHandling: 'merge', replaceUrl: true });
    });

  protected async onProjectCancel(): Promise<void> {
    if (this.hasProjectContent()) {
      const ok = await openConfirmDialog(this.injector, {
        title: '放棄新增專案？',
        message: '已填的內容不會保存。',
        confirmLabel: '放棄',
        tone: 'danger',
      });
      if (!ok) return;
    }
    this.restartProject();
  }

  protected restartProject(): void {
    this.created.set(null);
    this.project.reset();
    this.clearDraft();
    this.projectWizard()?.reset();
    this.projectStep.set(0);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { step: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected readonly submitContact = () => wait(600).then(() => this.contactEvent.set('已送出（示範）'));
  protected readonly submitReport = () =>
    wait(600).then(() => this.reportEvent.set(`已送出「${this.report.controls.describe.controls.summary.value}」（示範）`));

  /** 線性精靈不能一開始就停在前面還沒填好的步驟之後：?step= 超過時退回第一個還沒完成的必填步驟。 */
  private clampProjectStep(raw: string | null): number {
    const requested = Math.max(0, Math.min(3, (Number.parseInt(raw ?? '1', 10) || 1) - 1));
    const groups = [this.project.controls.basics, this.project.controls.members, this.project.controls.settings];
    const optional = [false, true, false];
    for (let i = 0; i < requested; i++) {
      if (!optional[i] && groups[i].invalid) return i;
    }
    return requested;
  }

  private hasProjectContent(): boolean {
    const v = this.project.getRawValue();
    return !!(v.basics.name || v.basics.code || v.basics.description || v.members.owner || v.settings.visibility || v.settings.dueDate);
  }

  private saveDraft(): void {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(this.project.getRawValue()));
    } catch {
      // 不能用 sessionStorage（私密模式等）就不存草稿。
    }
  }

  private clearDraft(): void {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // 同上。
    }
  }

  private restoreDraft(): void {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) this.project.patchValue(JSON.parse(raw));
    } catch {
      // 草稿壞掉或讀不到就從空白開始。
    }
  }

  protected readonly whenToUse = [
    '一份表單太長、但可以分成前後有順序的幾段：新增專案、開通帳號、匯入資料。',
    '後面的步驟依賴前面填的內容（先選類型，下一步才知道要填哪些欄位）。',
    '最後要讓使用者確認一次再送出。',
  ];
  protected readonly avoid = [
    '欄位不多、一頁放得下：用一般表單（工單表單樣板）。',
    '各段彼此無關、不必照順序：用分頁或設定頁樣板的分組導覽。',
    '只是要表達流程進度、不需要填寫：用狀態標籤或活動紀錄。',
  ];

  protected readonly usage = `// 頁面的 providers：畫面文字（{current}、{total}、{label}、{count} 會被換掉）
providers: [{ provide: STEP_WIZARD_LABELS, useValue: {
  previous: '上一步', next: '下一步', finish: '完成', submitting: '送出中…', cancel: '取消',
  optional: '選填', stepList: '步驟', compactStatus: '步驟 {current}／{total} · {label}',
  stepListToggle: '所有步驟', stepListError: '其他步驟需要修正', announce: '步驟 {current}，共 {total} 步：{label}',
  stateDone: '已完成', stateError: '有錯誤', stateLocked: '尚未開放', stateUpcoming: '未完成',
  errorSummary: '這一步有 {count} 個欄位需要修正', stepInvalid: '這一步還有內容需要修正',
} }]

<lib-step-wizard
  [(selectedIndex)]="step"
  [submitAction]="save"
  finishLabel="建立專案"
  [showCancel]="true"
  [headingLevel]="3"
  (cancel)="confirmCancel()"
>
  <lib-wizard-step label="基本資料" [stepControl]="form.controls.basics"
    [fieldLabels]="{ name: '專案名稱', code: '專案代碼' }">
    <div [formGroup]="form.controls.basics">…</div>
  </lib-wizard-step>
  <lib-wizard-step label="成員" optional [stepControl]="form.controls.members">…</lib-wizard-step>
  <lib-wizard-step label="確認"><lib-description-list [items]="summary()" /></lib-wizard-step>
</lib-step-wizard>

// save 回傳 Promise：送出中顯示「送出中…」並停用其他按鈕；reject 時留在原地
readonly save = () => this.api.createProject(this.form.getRawValue()).then(() => this.done.set(true));`;

  protected readonly api: ApiSection[] = [
    {
      title: 'lib-step-wizard 輸入',
      rows: [
        { name: '[linear]', type: 'boolean', default: 'true', description: '線性：下一步先驗證目前這一步，後面還沒開放的步驟鎖住。false 時每一步都能直接點，按「完成」才一次檢查全部。' },
        { name: '[(selectedIndex)]', type: 'number', default: '0', description: '目前第幾步（0 起算）。要寫進網址就在頁面雙向綁定；線性時往後跳仍會檢查前面的步驟。' },
        { name: '[orientation]', type: "'horizontal' | 'vertical'", default: "'horizontal'", description: 'vertical：步驟清單在左側一欄，適合步驟多、像設定頁的精靈。' },
        { name: '[submitAction]', type: '() => unknown | Promise', default: 'null', description: '按「完成」且全部驗證通過後呼叫；回傳 Promise 時等它結束（送出中）。失敗時 reject，精靈留在原地。' },
        { name: '[submitting]', type: 'boolean', default: 'false', description: '自己接 (finish) 送出時，由頁面控制送出中狀態。' },
        { name: '[finishLabel]', type: 'string', default: "''", description: '「完成」鈕的文字，例：「建立專案」；不給時用畫面文字的 finish。' },
        { name: '[showCancel]', type: 'boolean', default: 'false', description: '顯示「取消」（靠左）。按下只送出 cancel，要不要先確認由頁面決定。' },
        { name: '[compactBelow]', type: 'number', default: '600', description: '元件自己的寬度（不是視窗）小於這個值（px）時，步驟清單收成「步驟 2／4 · 成員」＋進度條。' },
        { name: '[headingLevel]', type: 'number', default: '2', description: '步驟標題的 aria-level，配合頁面的標題結構。' },
      ],
    },
    {
      title: 'lib-step-wizard 輸出與方法',
      rows: [
        { name: '(finish)', type: 'void', description: '全部驗證通過、按下「完成」（在 submitAction 之前）。' },
        { name: '(cancel)', type: 'void', description: '按下「取消」。' },
        { name: '(selectionChange)', type: 'StepperSelectionEvent', description: '換步驟（CDK 的事件，含前後兩個索引）。' },
        { name: 'goNext()／goPrevious()／submit()／reset()', type: 'method', description: '用程式按下一步、上一步、完成；reset() 回到第一步並清掉每一步的表單。' },
      ],
    },
    {
      title: 'lib-wizard-step 輸入',
      rows: [
        { name: 'label', type: 'string', default: '必填', description: '步驟名稱：步驟清單、標題、精簡列與報讀器都用它。' },
        { name: '[stepControl]', type: 'AbstractControl', default: 'null', description: '這一步的 FormGroup：下一步時全部標記為碰過並驗證。沒有表單的步驟（確認頁）不用給。' },
        { name: '[fieldLabels]', type: 'Record<string, string>', default: '{}', description: '控制項名稱（巢狀用 a.b）→ 欄位標籤，依畫面順序。錯誤摘要列出其中無效的欄位，焦點移到第一個（找 [data-field] 或 [formControlName]）。' },
        { name: 'optional', type: 'boolean', default: 'false', description: '選填步驟：名稱下方顯示「選填」，留白也能前進。' },
        { name: 'description', type: 'string', default: "''", description: '步驟標題下方的一句說明。' },
        { name: 'errorMessage', type: 'string', default: "''", description: '整組驗證失敗時，錯誤摘要下方的補充說明。' },
        { name: 'completed／editable', type: 'boolean', default: '—／true', description: 'CDK 的輸入：不用表單時自己標記完成；editable=false 時完成後不能再回來改。' },
      ],
    },
    {
      title: '注入',
      rows: [
        { name: 'STEP_WIZARD_LABELS', type: 'StepWizardLabels', default: '必填', description: '17 句畫面文字；少一句會在建立元件時丟出錯誤，列出缺的名稱。' },
      ],
    },
  ];
}
