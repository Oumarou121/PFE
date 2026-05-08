import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrganizationRecord as Organization } from '../../../../models/organization.model';

@Component({
  selector: 'app-organization-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './organization-list.component.html',
  styleUrls: ['./organization-list.component.scss'],
})
export class OrganizationListComponent {
  @Input() organizations: Organization[] = [];
  @Input() selectedId: string | null = null;
  @Output() select = new EventEmitter<string>();
  @Output() delete = new EventEmitter<string>();
  @Output() create = new EventEmitter<void>();

  onSelect(id: string): void { this.select.emit(id); }
  onDelete(id: string): void { this.delete.emit(id); }
  onCreateNew(): void { this.create.emit(); }
}
