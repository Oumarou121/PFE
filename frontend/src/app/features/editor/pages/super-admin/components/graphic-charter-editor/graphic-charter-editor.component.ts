import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GraphicCharterRecord as GraphicCharterEntry, GraphicCharterConfig } from '../../../../models/graphic-charter.model';

@Component({
  selector: 'app-graphic-charter-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './graphic-charter-editor.component.html',
  styleUrls: ['./graphic-charter-editor.component.scss'],
})
export class GraphicCharterEditorComponent implements OnInit, OnChanges {
  @Input() charter: GraphicCharterEntry | undefined;
  @Output() save = new EventEmitter<GraphicCharterEntry>();

  formData: Partial<GraphicCharterEntry> = {};
  config: GraphicCharterConfig | null = null;

  ngOnInit(): void { this.resetForm(); }
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['charter']) { this.resetForm(); }
  }

  private resetForm(): void {
    if (this.charter) {
      this.formData = { id: this.charter.id, name: this.charter.name, description: this.charter.description, isDefault: this.charter.isDefault };
      this.config = JSON.parse(JSON.stringify(this.charter.config));
    } else {
      this.formData = { name: '', description: '', isDefault: false };
      this.config = null;
    }
  }

  onSave(): void {
    if (!this.charter || !this.config) return;
    const updated: GraphicCharterEntry = {
      ...this.charter,
      ...(this.formData as GraphicCharterEntry),
      config: this.config,
    };
    this.save.emit(updated);
  }
}
