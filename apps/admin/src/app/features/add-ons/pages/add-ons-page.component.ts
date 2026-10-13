import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import {
  DataTableCellDirective,
  DataTableColumn,
  DataTableComponent,
  PageToolbarComponent,
} from '@car-rental/ui';
import { AddOn } from '../../../core/models';
import { ZH_TW } from '../../../core/i18n/zh-tw';
import { TwdPipe } from '../../../shared/pipes/twd.pipe';
import { AddOnStore } from '../../../stores/addon/addon.store';
import { confirm } from '../../../shared/dialogs/confirm-dialog.component';
import { HeaderToolbarDirective } from '../../../layout/header/header-toolbar-slot';
import { ADMIN_DATA_TABLE_LABELS } from '../../../shared/ui/data-table-labels';
import { AddOnDialogComponent, AddOnFormResult } from '../dialogs/add-on-dialog.component';
import { LIST_TOOLBAR_LABEL_PROVIDERS } from '../../../shared/ui/list-toolbar-labels';

@Component({
  selector: 'app-add-ons-page',
  imports: [
    DataTableComponent,
    DataTableCellDirective,
    MatButtonModule,
    MatTooltipModule,
    PageToolbarComponent,
    HeaderToolbarDirective,
    TwdPipe,
  ],
  templateUrl: './add-ons-page.component.html',
  styleUrls: ['../../../app.scss'],
  providers: [LIST_TOOLBAR_LABEL_PROVIDERS],
})
export class AddOnsPageComponent {
  protected readonly t = ZH_TW;
  readonly store = inject(AddOnStore);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  readonly labels = ADMIN_DATA_TABLE_LABELS;

  readonly columns: DataTableColumn<AddOn>[] = [
    { key: 'name', label: this.t.addOn.name, primary: true },
    { key: 'unitPrice', label: this.t.addOn.unitPrice, primary: true, align: 'end' },
    {
      key: 'unit',
      label: this.t.addOn.unit,
      exportValue: (a) => this.t.addOn.unitLabels[a.unit],
    },
    { key: 'actions', virtual: true, label: this.t.common.actions, exportSkip: true },
  ];

  readonly selectedAddOns = signal<readonly AddOn[]>([]);

  onExportFailed(e: Error): void {
    console.error('DataTable 匯出失敗', e);
    this.snackBar.open(this.labels.exportFailedText, undefined, { duration: 3000 });
  }

  async openForm(addOn: AddOn | null): Promise<void> {
    const ref = this.dialog.open(AddOnDialogComponent, { data: addOn, width: '420px' });
    const result: AddOnFormResult | undefined = await firstValueFrom(ref.afterClosed());
    if (!result) return;
    try {
      if (addOn) this.store.update(addOn.id, result);
      else this.store.create(result);
    } catch (e) {
      this.snackBar.open((e as Error).message, undefined, { duration: 3000 });
    }
  }

  async remove(addOn: AddOn): Promise<void> {
    if (!(await confirm(this.dialog, this.t.common.deleteConfirm))) return;
    try {
      this.store.remove(addOn.id);
    } catch (e) {
      this.snackBar.open((e as Error).message, undefined, { duration: 3000 });
    }
  }

  async removeSelected(addOns: readonly AddOn[]): Promise<void> {
    if (!(await confirm(this.dialog, this.t.common.deleteConfirm))) return;
    for (const addOn of addOns) {
      try {
        this.store.remove(addOn.id);
      } catch (e) {
        this.snackBar.open((e as Error).message, undefined, { duration: 3000 });
      }
    }
    this.selectedAddOns.set([]);
  }
}
