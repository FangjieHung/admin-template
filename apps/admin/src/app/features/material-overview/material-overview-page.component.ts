import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DEMO_CONTACTS, DEMO_PROJECTS } from '../../showcase/demo-data';
import { DemoBlockComponent } from '../../showcase/demo-block.component';
import { ShowcasePageComponent } from '../../showcase/showcase-page.component';
import { detailOf } from '../../showcase/showcase-catalog';

@Component({
  selector: 'app-overview-dialog',
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule],
  template: `
    <h2 mat-dialog-title>對話框標題</h2>
    <div mat-dialog-content>
      <p>{{ data }}</p>
      <!-- 對話框裡的欄位：對比掃描在這裡量欄位滑過、焦點與錯誤狀態。 -->
      <mat-form-field appearance="outline" class="w-full">
        <mat-label>名稱（必填）</mat-label>
        <input matInput [formControl]="name" required />
        <mat-error>請輸入名稱</mat-error>
      </mat-form-field>
      <mat-form-field appearance="outline" class="w-full">
        <mat-label>備註</mat-label>
        <input matInput />
      </mat-form-field>
    </div>
    <div mat-dialog-actions align="end">
      <button matButton type="button" mat-dialog-close>取消</button>
      <button matButton="filled" type="button" [mat-dialog-close]="true">確定</button>
    </div>
  `,
})
export class OverviewDialogComponent {
  protected readonly data = inject<string>(MAT_DIALOG_DATA);
  protected readonly name = new FormControl('', { nonNullable: true, validators: [Validators.required] });
}

const ENTRY = detailOf('material');

/**
 * Material 元件總覽：範本支援的每一種 Angular Material 控制項與 theme-pack 的 ui-* class，各種狀態排在同一頁。
 * 這一頁是質地的測試台——新增或修改質地時，每個 recipe 都應該在這裡看得到效果。
 */
@Component({
  selector: 'app-material-overview-page',
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatBadgeModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatChipsModule,
    MatDatepickerModule,
    MatDialogModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatInputModule,
    MatListModule,
    MatMenuModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatStepperModule,
    MatTableModule,
    MatTabsModule,
    MatTimepickerModule,
    MatTooltipModule,
    ShowcasePageComponent,
    DemoBlockComponent,
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './material-overview-page.component.html',
  styleUrl: './material-overview-page.component.scss',
})
export class MaterialOverviewPageComponent {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly entry = ENTRY;
  protected readonly buttonVariants = [
    { variant: 'text', label: 'Text' },
    { variant: 'filled', label: 'Filled' },
    { variant: 'tonal', label: 'Tonal' },
    { variant: 'outlined', label: 'Outlined' },
    { variant: 'elevated', label: 'Elevated' },
  ] as const;

  /** 錯誤狀態的欄位：一進頁就標成 touched，錯誤訊息直接顯示。 */
  protected readonly requiredControl = new FormControl('', { nonNullable: true, validators: [Validators.required] });
  protected readonly emailControl = new FormControl('not-an-email', { nonNullable: true, validators: [Validators.email] });
  protected readonly disabledControl = new FormControl({ value: '不能修改的值', disabled: true }, { nonNullable: true });
  protected readonly selectErrorControl = new FormControl<string | null>(null, [Validators.required]);

  protected readonly contacts = DEMO_CONTACTS;
  protected readonly projects = DEMO_PROJECTS;
  protected readonly contactQuery = signal('');
  protected readonly contactOptions = computed(() => {
    const q = this.contactQuery().trim();
    return q ? this.contacts.filter((c) => c.name.includes(q) || c.team.includes(q)) : this.contacts;
  });

  protected readonly filterChips = ['全部', '待處理', '進行中', '已完成'];
  protected readonly tags = signal(['設計', '前端', '急件']);

  protected readonly tableColumns = ['name', 'owner', 'progress', 'budget'];
  protected readonly today = new Date();

  protected readonly toneSamples = [
    { tone: 'positive', label: '已完成' },
    { tone: 'info', label: '處理中' },
    { tone: 'neutral', label: '草稿' },
    { tone: 'warning', label: '即將到期' },
    { tone: 'danger', label: '失敗' },
  ] as const;

  protected readonly navPills = ['本週', '本月', '本季'];
  protected readonly activePill = signal('本月');

  protected readonly whenToUse = [
    '新增或修改質地時，逐一檢查每個控制項的圓角、陰影、邊線、字體是否套到。',
    '挑選要用哪一種按鈕或欄位外觀時，對照各狀態（停用、錯誤、提示）的長相。',
    '寫新元件前先找：這裡有的控制項直接用，不要自己畫。',
  ];

  protected readonly usage = `<!-- 按鈕：用 matButton 的變體，不要自己寫按鈕樣式 -->
<button matButton="filled">儲存</button>
<button matButton="outlined">取消</button>
<button matIconButton aria-label="更多操作"><span class="material-symbols-rounded">more_vert</span></button>

<!-- 欄位：outline 用在一般表單，fill 用在篩選列與 ui-field-group -->
<mat-form-field appearance="outline">
  <mat-label>專案名稱</mat-label>
  <input matInput [formControl]="name" />
  <mat-hint>最多 40 字</mat-hint>
  <mat-error>必填</mat-error>
</mat-form-field>

<!-- 卡片、狀態、字級：用 theme-pack 的 ui-* class -->
<section class="ui-card">
  <p class="ui-text-caption">本月</p>
  <p class="ui-text-display ui-text-numeric">128</p>
  <span class="ui-chip ui-chip--positive"><span class="ui-chip__dot"></span>已完成</span>
</section>`;

  constructor() {
    this.requiredControl.markAsTouched();
    this.emailControl.markAsTouched();
    this.selectErrorControl.markAsTouched();
  }

  protected onContactInput(event: Event): void {
    this.contactQuery.set((event.target as HTMLInputElement).value);
  }

  protected removeTag(tag: string): void {
    this.tags.update((list) => list.filter((t) => t !== tag));
  }

  protected openDialog(): void {
    this.dialog.open(OverviewDialogComponent, { data: '對話框的內容。外框、圓角、陰影與遮罩都由質地決定。', width: '400px' });
  }

  protected openSnackBar(): void {
    this.snackBar.open('已儲存變更', '復原', { duration: 4000 });
  }
}
