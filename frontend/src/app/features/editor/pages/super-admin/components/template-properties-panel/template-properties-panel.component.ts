import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TemplateRecord as Template } from '../../../../models/template.model';
import { OrganizationRecord as Organization } from '../../../../models/organization.model';
import { GraphicCharterRecord as GraphicCharterEntry } from '../../../../models/graphic-charter.model';

@Component({
  selector: 'app-template-properties-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './template-properties-panel.component.html',
  styleUrls: ['./template-properties-panel.component.scss'],
})
export class TemplatePropertiesPanelComponent implements OnChanges {
  @Input() template: Template | undefined;
  @Input() organizations: Organization[] = [];
  @Input() charters: GraphicCharterEntry[] = [];
  @Output() save = new EventEmitter<Template>();

  localTemplate: Partial<Template> = {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['template'] && this.template) {
      this.localTemplate = { ...this.template };
    }
  }

  onSave(): void {
    if (!this.template) return;
    this.save.emit({ ...this.template, ...this.localTemplate } as Template);
  }
}
