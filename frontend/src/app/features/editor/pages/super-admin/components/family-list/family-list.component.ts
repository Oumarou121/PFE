import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FamilyRecord as Family } from '../../../../models/family.model';

@Component({
  selector: 'app-family-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './family-list.component.html',
  styleUrls: ['./family-list.component.scss'],
})
export class FamilyListComponent {
  @Input() families: Family[] = [];
  @Input() selectedId: string | null = null;
  @Output() select = new EventEmitter<string>();
  @Output() delete = new EventEmitter<string>();
  @Output() create = new EventEmitter<void>();

  onSelect(id: string): void {
    this.select.emit(id);
  }

  onDelete(id: string): void {
    this.delete.emit(id);
  }

  onCreateNew(): void {
    this.create.emit();
  }
}
