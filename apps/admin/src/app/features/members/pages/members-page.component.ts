import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  DataTableCellDirective,
  DataTableColumn,
  DataTableComponent,
  PageToolbarComponent,
} from '@car-rental/ui';
import { Member } from '../../../core/models';
import { ZH_TW } from '../../../core/i18n/zh-tw';
import { MemberStore } from '../../../stores/member/member.store';
import { confirm } from '../../../shared/dialogs/confirm-dialog.component';
import { HeaderToolbarDirective } from '../../../layout/header/header-toolbar-slot';
import { provideHeaderTitle } from '../../../layout/header/header-title';
import { ADMIN_DATA_TABLE_LABELS } from '../../../shared/ui/data-table-labels';
import { MemberFormDialogComponent } from '../dialogs/member-form-dialog.component';

@Component({
  selector: 'app-members-page',
  imports: [
    DataTableComponent,
    DataTableCellDirective,
    MatButtonModule,
    MatTooltipModule,
    PageToolbarComponent,
    HeaderToolbarDirective,
  ],
  templateUrl: './members-page.component.html',
  styleUrls: ['../../../app.scss'],
})
export class MembersPageComponent {
  protected readonly t = ZH_TW;
  readonly store = inject(MemberStore);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  readonly labels = ADMIN_DATA_TABLE_LABELS;

  constructor() {
    // 2.1：頁首麵包屑「訂單管理」（可點回列表）› 大標題「會員」（原本誤顯示「訂單管理」）。
    provideHeaderTitle(() => ({
      title: this.t.membersPage.title,
      breadcrumbs: [{ label: this.t.nav.orders, route: '/orders' }],
    }));
  }

  readonly columns: DataTableColumn<Member>[] = [
    { key: 'name', label: this.t.member.name, primary: true },
    { key: 'phone', label: this.t.member.phone, primary: true },
    {
      key: 'kind',
      label: this.t.member.kind,
      exportValue: (c) => this.t.member.kindLabels[c.kind] ?? c.kind,
    },
    { key: 'idNumber', label: this.t.member.idNumber, exportValue: (c) => c.idNumber ?? '—' },
    { key: 'note', label: this.t.member.note, exportValue: (c) => c.note ?? '' },
    { key: 'actions', virtual: true, label: this.t.common.actions, exportSkip: true },
  ];

  onExportFailed(e: Error): void {
    console.error('DataTable 匯出失敗', e);
    this.snackBar.open(this.labels.exportFailedText, undefined, { duration: 3000 });
  }

  // 會員基本資料、證件與駕駛資格的建立/更新現在都在 dialog 內部完成
  // （MemberStore + DocumentStore 各自的 create/update/confirm），這裡只負責開啟，
  // 不再回頭套用表單值——MemberStore 的 members() signal 會在 dialog 內部呼叫
  // create/update 後自動反映最新資料，不需要額外重新整理。
  openForm(member: Member | null): void {
    this.dialog.open(MemberFormDialogComponent, { data: member, width: '640px', maxWidth: '92vw' });
  }

  async remove(member: Member): Promise<void> {
    if (await confirm(this.dialog, this.t.common.deleteConfirm)) this.store.remove(member.id);
  }
}
