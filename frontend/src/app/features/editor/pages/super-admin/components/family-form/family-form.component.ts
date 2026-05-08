import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FamilyRecord as Family, VariableDefinition as FamilyVar } from '../../../../models/family.model';

@Component({
  selector: 'app-family-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './family-form.component.html',
  styleUrls: ['./family-form.component.scss'],
})
export class FamilyFormComponent implements OnInit, OnChanges {
  @Input() family: Family | undefined;
  @Output() save = new EventEmitter<Family>();

  // Local editable copy
  formData: Partial<Family> = {};
  vars: FamilyVar[] = [];

  readonly varTypes: Array<FamilyVar['type']> = ['scalar', 'list', 'list-object'];
  readonly beneficiaryModes: Array<Family['beneficiaryMode']> = ['table', 'organization'];

  ngOnInit(): void {
    this.resetForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['family']) {
      this.resetForm();
    }
  }

  private resetForm(): void {
    if (this.family) {
      this.formData = { ...this.family };
      this.vars = (this.family.classes?.[0]?.vars ?? []).map(v => ({ ...v }));
    } else {
      this.formData = {
        id: '',
        nom: '',
        beneficiaryMode: 'table',
        beneficiaryTable: null,
        beneficiaryTableLabel: '',
        beneficiaryDisplayColumn1: '',
        beneficiaryDisplayColumn2: '',
        beneficiaryLinkColumn: '',
        beneficiarySql: '',
        filterCatalog: [],
      };
      this.vars = [];
    }
  }

  addVar(): void {
    this.vars.push({ tech: '', label: '', type: 'scalar' });
  }

  removeVar(index: number): void {
    this.vars.splice(index, 1);
  }

  onSave(): void {
    const family: Family = {
      ...(this.formData as Family),
      classes: this.family?.classes?.length
        ? [{ ...this.family.classes[0], vars: this.vars }]
        : this.vars.length
          ? [{ id: 'default', label: 'Variables', vars: this.vars }]
          : [],
    };
    this.save.emit(family);
  }
}
