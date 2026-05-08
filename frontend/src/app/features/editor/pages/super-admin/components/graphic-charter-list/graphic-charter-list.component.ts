import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GraphicCharterRecord as GraphicCharterEntry } from '../../../../models/graphic-charter.model';

@Component({
  selector: 'app-graphic-charter-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './graphic-charter-list.component.html',
  styleUrls: ['./graphic-charter-list.component.scss'],
})
export class GraphicCharterListComponent {
  @Input() charters: GraphicCharterEntry[] = [];
  @Input() selectedId: string | null = null;
  @Output() select = new EventEmitter<string>();
  @Output() delete = new EventEmitter<string>();
  @Output() create = new EventEmitter<void>();

  onSelect(id: string): void { this.select.emit(id); }
  onDelete(id: string): void { this.delete.emit(id); }
  onCreateNew(): void { this.create.emit(); }
}
