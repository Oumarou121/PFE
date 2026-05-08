import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminAccountRecord as AdminAccount } from '../../../../models/admin-account.model';

@Component({
  selector: 'app-admin-account-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-account-list.component.html',
  styleUrls: ['./admin-account-list.component.scss'],
})
export class AdminAccountListComponent {
  @Input() admins: AdminAccount[] = [];
  @Input() selectedId: string | null = null;
  @Output() select = new EventEmitter<string>();
  @Output() delete = new EventEmitter<string>();
  @Output() create = new EventEmitter<void>();

  onSelect(id: string): void { this.select.emit(id); }
  onDelete(id: string): void { this.delete.emit(id); }
  onCreateNew(): void { this.create.emit(); }
}
