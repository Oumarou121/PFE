import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TemplateRecord as Template } from '../../../../models/template.model';

@Component({
  selector: 'app-template-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './template-list.component.html',
  styleUrls: ['./template-list.component.scss'],
})
export class TemplateListComponent {
  @Input() templates: Template[] = [];
  @Input() selectedId: string | null = null;
  @Output() select = new EventEmitter<string>();
  @Output() delete = new EventEmitter<string>();
  @Output() create = new EventEmitter<void>();

  onSelect(id: string): void { this.select.emit(id); }
  onDelete(id: string): void { this.delete.emit(id); }
  onCreateNew(): void { this.create.emit(); }
}
