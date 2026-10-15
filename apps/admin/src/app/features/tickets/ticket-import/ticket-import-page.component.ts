import { Component, Injector, inject, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import {
  ImportResult,
  ImportSchema,
  ImportTarget,
  ImportWizardComponent,
  ToastService,
  createLocalStorageMappingStore,
  openConfirmDialog,
} from '@admin-template/ui';
import { provideHeaderTitle } from '../../../layout/header/header-title';
import { HeaderToolbarDirective } from '../../../layout/header/header-toolbar-slot';
import { TOAST_PROVIDERS } from '../../../shared/ui/component-label-providers';
import { IMPORT_LEAVE_CONFIRM, IMPORT_WIZARD_LABEL_PROVIDERS } from '../../../shared/ui/import-wizard-labels';
import { TemplateInfo, TemplateInfoComponent } from '../../../shared/ui/template-info.component';
import { TICKET_ASSIGNEES } from '../data/ticket-demo-data';
import { TicketRepository } from '../data/ticket.repository';
import {
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_TITLE_MAX,
  TicketCategory,
  TicketDraft,
  TicketPriority,
} from '../data/ticket.model';
import { TicketListMemory } from '../ticket-list/ticket-list-url';

const ACTOR = { name: '你' };

/** 檔案裡也接受的寫法（不分大小寫、全形半形）。 */
const CATEGORY_SYNONYMS: Readonly<Record<TicketCategory, readonly string[]>> = {
  hardware: ['硬體設備', '設備'],
  software: ['軟體問題', '系統'],
  account: ['帳號', '權限'],
  network: ['網路連線', 'wifi'],
  other: ['其它'],
};
const PRIORITY_SYNONYMS: Readonly<Record<TicketPriority, readonly string[]>> = {
  low: ['不急'],
  medium: ['普通', '一般'],
  high: ['重要'],
  urgent: ['急', '最優先'],
};

/** 匯入的一列（依 schema 轉換後的值）。 */
interface TicketImportValue {
  title: string;
  category: TicketCategory | null;
  priority: TicketPriority | null;
  assigneeId: string | null;
  dueDate: string | null;
  description: string | null;
}

const INFO: TemplateInfo = {
  summary: '匯入頁樣板：從工單列表的「匯入」進來，上傳 CSV 或 Excel、對應欄位、預覽修正後分批建立工單；完成後回到列表並提示匯入了幾筆。',
  components: [
    'lib-import-wizard（裡面是 lib-step-wizard、lib-file-upload、lib-data-table、lib-status-chip、確認對話框）',
    'lib-toast（回到列表後的提示）',
    'libs/access：只有能新增工單的角色看得到「匯入」，直接開網址也會檢查',
    'libs/access 的 unsavedChangesGuard：選了檔案還沒匯入完成就離開時先確認（讀精靈的 hasUnsavedWork()）',
  ],
  replace: [
    '本頁的 schema（要匯入的欄位、選項的其他寫法、負責人的比對方式）',
    'ticket.repository.ts：existingTitles()、importBatch() 換成呼叫後端',
  ],
  files: [
    'apps/admin/src/app/features/tickets/ticket-import/',
    'apps/admin/src/app/features/tickets/data/ticket.repository.ts',
    'apps/admin/src/app/features/tickets/tickets.routes.ts（import 路由、權限與離開前確認）',
  ],
};

/**
 * 工單匯入（頁面樣板，/templates/tickets/import）：判斷重複用「主旨」（工單沒有外部編號）；負責人用名字比對成 id，
 * 找不到時那一格標成錯誤。完成後回到列表（帶著列表原本的篩選與頁碼），新匯入的工單在最上面。
 */
@Component({
  selector: 'app-ticket-import-page',
  imports: [ImportWizardComponent, HeaderToolbarDirective, TemplateInfoComponent],
  providers: [...IMPORT_WIZARD_LABEL_PROVIDERS, ...TOAST_PROVIDERS],
  template: `
    <ng-template appHeaderToolbar>
      <app-template-info [info]="info" />
    </ng-template>
    <section class="ui-card ticket-import">
      <lib-import-wizard
        [schema]="schema"
        [target]="target"
        [mappingStore]="mappingStore"
        mappingId="tickets"
        [showCancel]="true"
        templateFileName="工單匯入範本.csv"
        reportFileName="工單匯入錯誤報告.csv"
        (cancel)="backToList()"
        (finished)="onFinished($event)"
      />
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
    .ticket-import {
      max-width: 80rem;
      padding: 1rem;
    }
    @media (min-width: 640px) {
      .ticket-import {
        padding: 1.5rem;
      }
    }
  `,
})
export class TicketImportPageComponent {
  private readonly repo = inject(TicketRepository);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly listParams = inject(TicketListMemory).queryParams;
  private readonly injector = inject(Injector);
  private readonly wizard = viewChild(ImportWizardComponent);

  protected readonly info = INFO;
  protected readonly mappingStore = createLocalStorageMappingStore('admin-template.ticket-import');

  protected readonly schema: ImportSchema = {
    key: 'title',
    fields: [
      {
        key: 'title',
        label: '主旨',
        required: true,
        type: 'text',
        synonyms: ['標題', '工單標題', 'subject', 'title'],
        example: '會議室投影機無法開機',
        validate: (value) => (String(value).length > TICKET_TITLE_MAX ? `主旨不能超過 ${TICKET_TITLE_MAX} 個字` : null),
      },
      {
        key: 'category',
        label: '分類',
        type: 'enum',
        synonyms: ['類別', 'category'],
        options: (Object.entries(TICKET_CATEGORY_LABELS) as [TicketCategory, string][]).map(([value, label]) => ({
          value,
          label,
          synonyms: CATEGORY_SYNONYMS[value],
        })),
      },
      {
        key: 'priority',
        label: '優先順序',
        type: 'enum',
        synonyms: ['優先', '急迫程度', 'priority'],
        options: (Object.entries(TICKET_PRIORITY_LABELS) as [TicketPriority, string][]).map(([value, label]) => ({
          value,
          label,
          synonyms: PRIORITY_SYNONYMS[value],
        })),
      },
      {
        key: 'assigneeId',
        label: '負責人',
        type: 'text',
        synonyms: ['處理人', '指派給', 'assignee'],
        example: TICKET_ASSIGNEES[0].name,
        transform: (value) => {
          const person = TICKET_ASSIGNEES.find((p) => p.name === String(value).trim());
          if (!person) throw new Error('找不到這位負責人，請填同仁的姓名');
          return person.id;
        },
      },
      { key: 'dueDate', label: '到期日', type: 'date', synonyms: ['期限', '截止日', 'due'], example: '2026-11-30' },
      { key: 'description', label: '描述', type: 'text', synonyms: ['說明', '內容', 'description'] },
    ],
  };

  protected readonly target: ImportTarget<TicketImportValue> = {
    findExisting: (titles, signal) => this.repo.existingTitles(titles, signal),
    importBatch: async (rows, { signal }) => {
      const result = await this.repo.importBatch(
        rows.map((record) => ({ row: record.row, action: record.action, draft: toDraft(record.value) })),
        ACTOR,
        signal,
      );
      return { ...result, skipped: 0 };
    },
  };

  constructor() {
    provideHeaderTitle(() => ({
      title: '匯入工單',
      breadcrumbs: [{ label: '頁面樣板' }, { label: '工單', route: '/templates/tickets' }],
    }));
  }

  /** 路由離開前（tickets.routes.ts 的 canDeactivate）：選了檔案但還沒匯入完成就先問；按「取消」或匯入完成後不問。 */
  canLeave(): boolean | Promise<boolean> {
    if (!this.wizard()?.hasUnsavedWork()) return true;
    return openConfirmDialog(this.injector, IMPORT_LEAVE_CONFIRM);
  }

  protected backToList(): void {
    void this.router.navigate(['/templates/tickets'], { queryParams: this.listParams });
  }

  protected async onFinished(result: ImportResult): Promise<void> {
    await this.router.navigate(['/templates/tickets'], { queryParams: this.listParams });
    const count = result.created + result.updated;
    if (count > 0) this.toast.success(`已匯入 ${count} 筆工單`);
    else this.toast.info('沒有匯入任何工單');
  }
}

function toDraft(value: TicketImportValue): Partial<TicketDraft> & { title: string } {
  return {
    title: value.title,
    category: value.category ?? undefined,
    priority: value.priority ?? undefined,
    assigneeId: value.assigneeId ?? undefined,
    dueDate: value.dueDate ?? undefined,
    description: value.description ?? undefined,
  };
}
