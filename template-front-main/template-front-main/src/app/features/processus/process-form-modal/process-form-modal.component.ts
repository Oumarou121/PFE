import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Process, ProcessType, ReviewFrequency } from '../../../shared/models/process.model';

interface DialogData {
  process: Process | null;
  isEdit: boolean;
}

@Component({
  selector: 'app-process-form-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './process-form-modal.component.html',
  styleUrls: ['./process-form-modal.component.scss']
})
export class ProcessFormModalComponent implements OnInit {
  processForm!: FormGroup;
  kpis: string[] = [];
  ProcessType = ProcessType;
  ReviewFrequency = ReviewFrequency;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<ProcessFormModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) {
    console.log('ProcessFormModalComponent initialized with data:', data);
  }

  ngOnInit(): void {
    this.initForm();
    if (this.data.process) {
      this.loadProcessData();
    }
  }

  initForm(): void {
    const today = new Date().toISOString().split('T')[0];
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const nextYearStr = nextYear.toISOString().split('T')[0];

    this.processForm = this.fb.group({
      code: ['', [Validators.required]],
      name: ['', [Validators.required]],
      type: ['', [Validators.required]],
      objective: ['', [Validators.required]],
      pilot: ['', [Validators.required]],
      reviewFrequency: [ReviewFrequency.SEMESTRIELLE],
      createdDate: [today],
      nextReview: [nextYearStr],
      conformityScore: [75],
      clauseISO: ['']
    });

    this.kpis = ['Taux de conformité', 'Délai moyen de traitement'];
    console.log('Form initialized:', this.processForm.value);
  }

  loadProcessData(): void {
    if (this.data.process) {
      console.log('Loading process data:', this.data.process);
      this.processForm.patchValue(this.data.process);
      this.kpis = [...(this.data.process.kpis || [])];
      if (this.kpis.length === 0) {
        this.kpis = ['Taux de conformité', 'Délai moyen de traitement'];
      }
    }
  }

  selectPilot(pilot: string): void {
    console.log('Selecting pilot:', pilot);
    this.processForm.patchValue({ pilot });
  }

  addKPI(): void {
    this.kpis.push('');
    console.log('Added KPI, current KPIs:', this.kpis);
  }

  removeKPI(index: number): void {
    this.kpis.splice(index, 1);
    console.log('Removed KPI at index', index, 'current KPIs:', this.kpis);
  }

  updateScoreDisplay(): void {
    // Trigger change detection for score color update
  }

  getScoreColor(): string {
    const score = this.processForm.get('conformityScore')?.value || 0;
    if (score >= 80) return 'var(--s-green)';
    if (score >= 60) return 'var(--s-yellow)';
    return 'var(--s-red)';
  }

  onSave(): void {
    console.log('Save clicked, form valid:', this.processForm.valid);
    console.log('Form value:', this.processForm.value);
    console.log('Form errors:', this.getFormErrors());
    
    if (this.processForm.valid) {
      const formValue = this.processForm.value;
      const processData = {
        ...formValue,
        kpis: this.kpis.filter(kpi => kpi.trim() !== ''),
        status: this.getStatusFromScore(formValue.conformityScore)
      };
      console.log('Saving process data:', processData);
      this.dialogRef.close(processData);
    } else {
      // Mark all fields as touched to show validation errors
      Object.keys(this.processForm.controls).forEach(key => {
        this.processForm.get(key)?.markAsTouched();
      });
      console.log('Form is invalid, marking all fields as touched');
    }
  }

  onCancel(): void {
    console.log('Cancel clicked');
    this.dialogRef.close();
  }

  private getStatusFromScore(score: number): string {
    if (score >= 80) return 'Conforme';
    if (score >= 60) return 'À surveiller';
    return 'Non conforme';
  }

  private getFormErrors(): any {
    const errors: any = {};
    Object.keys(this.processForm.controls).forEach(key => {
      const control = this.processForm.get(key);
      if (control && control.errors) {
        errors[key] = control.errors;
      }
    });
    return errors;
  }
}