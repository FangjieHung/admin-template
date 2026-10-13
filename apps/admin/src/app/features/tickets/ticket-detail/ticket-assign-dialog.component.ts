import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { RelationSelectComponent } from '@admin-template/ui';
import { TicketPerson } from '../data/ticket.model';
import { TicketRepository } from '../data/ticket.repository';

export interface TicketAssignDialogData {
  ticketId: string;
  title: string;
  assigneeId: string | null;
}

/** 關掉時回傳的結果；按取消、Esc 或點遮罩是 undefined。 */
export interface TicketAssignDialogResult {
  assigneeId: string | null;
}

/** 詳情頁的「指派」：小對話框裡一個 relation-select；清空就是取消指派。 */
@Component({
  selector: 'app-ticket-assign-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, RelationSelectComponent],
  template: `
    <h2 mat-dialog-title>指派工單</h2>
    <mat-dialog-content class="assign-dialog">
      <p class="assign-dialog__ticket"><span class="ui-text-numeric">{{ data.ticketId }}</span> {{ data.title }}</p>
      <lib-relation-select
        label="負責人"
        placeholder="輸入姓名或單位"
        hint="清空就是取消指派"
        [formControl]="assignee"
        [source]="repo.assigneeSource"
        [displayWith]="name"
        [secondaryWith]="team"
        [avatarWith]="initials"
      />
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button type="button" matButton mat-dialog-close>取消</button>
      <button type="button" matButton="filled" [disabled]="unchanged()" (click)="save()">指派</button>
    </mat-dialog-actions>
  `,
  styles: `
    .assign-dialog {
      display: grid;
      gap: 0.75rem;
      min-width: min(24rem, 80vw);
    }

    .assign-dialog__ticket {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.875rem;
    }

    lib-relation-select {
      display: block;
    }
  `,
})
export class TicketAssignDialogComponent {
  protected readonly data = inject<TicketAssignDialogData>(MAT_DIALOG_DATA);
  protected readonly repo = inject(TicketRepository);
  private readonly ref = inject<MatDialogRef<TicketAssignDialogComponent, TicketAssignDialogResult>>(MatDialogRef);

  protected readonly assignee = new FormControl<string | null>(this.data.assigneeId);
  private readonly value = toSignal(this.assignee.valueChanges, { initialValue: this.data.assigneeId });

  protected readonly name = (p: TicketPerson) => p.name;
  protected readonly team = (p: TicketPerson) => p.team;
  protected readonly initials = (p: TicketPerson) => Array.from(p.name).slice(-2).join('');

  protected unchanged(): boolean {
    return (this.value() ?? null) === this.data.assigneeId;
  }

  protected save(): void {
    this.ref.close({ assigneeId: this.value() ?? null });
  }
}
