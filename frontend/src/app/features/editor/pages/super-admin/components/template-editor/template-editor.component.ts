import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TemplateRecord as Template } from '../../../../models/template.model';
import { FamilyRecord as Family } from '../../../../models/family.model';

type EditorSection = 'header' | 'body' | 'footer';

@Component({
  selector: 'app-template-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './template-editor.component.html',
  styleUrls: ['./template-editor.component.scss'],
})
export class TemplateEditorComponent implements OnInit, OnChanges {
  @Input() template: Template | undefined;
  @Input() families: Family[] = [];
  @Output() save = new EventEmitter<Template>();

  activeSection: EditorSection = 'body';
  readonly sections: EditorSection[] = ['header', 'body', 'footer'];

  editorContent: Record<EditorSection, string> = {
    header: '',
    body: '',
    footer: '',
  };

  formMeta: Partial<Template> = {};

  ngOnInit(): void {
    this.resetEditor();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['template']) {
      this.resetEditor();
    }
  }

  private resetEditor(): void {
    if (this.template) {
      this.editorContent = {
        header: this.template.header ?? '',
        body: this.template.body ?? '',
        footer: this.template.footer ?? '',
      };
      this.formMeta = {
        nom: this.template.nom,
        familyId: this.template.familyId,
        organizationId: this.template.organizationId,
        graphicCharterId: this.template.graphicCharterId,
        hasHeader: this.template.hasHeader,
        hasFooter: this.template.hasFooter,
      };
    } else {
      this.editorContent = { header: '', body: '', footer: '' };
      this.formMeta = {};
    }
  }

  selectSection(section: EditorSection): void {
    this.activeSection = section;
  }

  getSectionLabel(section: EditorSection): string {
    const labels: Record<EditorSection, string> = {
      header: 'En-tête',
      body: 'Corps',
      footer: 'Pied de page',
    };
    return labels[section];
  }

  onSave(): void {
    if (!this.template) return;
    const updated: Template = {
      ...this.template,
      ...this.formMeta,
      header: this.editorContent['header'],
      body: this.editorContent['body'],
      footer: this.editorContent['footer'],
    };
    this.save.emit(updated);
  }
}
