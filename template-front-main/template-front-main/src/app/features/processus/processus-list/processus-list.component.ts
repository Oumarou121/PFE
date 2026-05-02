import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { Process, ProcessType, ProcessStatus } from '../../../shared/models/process.model';
import { ProcessService } from '../../../core/services/process.service';
import { ToastService } from '../../../shared/services/toast.service';
import { ProcessFormModalComponent } from '../process-form-modal/process-form-modal.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-processus-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatSnackBarModule
  ],
  templateUrl: './processus-list.component.html',
  styleUrls: ['./processus-list.component.scss']
})
export class ProcessusListComponent implements OnInit {
  processes: Process[] = [];
  filteredProcesses: Process[] = [];
  viewMode: 'cards' | 'table' = 'cards';
  searchTerm: string = '';
  selectedType: string = '';
  selectedStatus: string = '';

  ProcessType = ProcessType;
  ProcessStatus = ProcessStatus;

  constructor(
    private processService: ProcessService,
    private dialog: MatDialog,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadProcesses();
  }

  loadProcesses(): void {
    this.processService.getProcesses().subscribe({
      next: (processes) => {
        this.processes = processes;
        this.applyFilters();
      },
      error: (error) => {
        this.toastService.showError('Erreur lors du chargement des processus');
        console.error('Error loading processes:', error);
      }
    });
  }

  applyFilters(): void {
    this.filteredProcesses = this.processes.filter(process => {
      const matchesSearch = !this.searchTerm || 
        process.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        process.code.toLowerCase().includes(this.searchTerm.toLowerCase());
      
      const matchesType = !this.selectedType || process.type === this.selectedType;
      const matchesStatus = !this.selectedStatus || process.status === this.selectedStatus;
      
      return matchesSearch && matchesType && matchesStatus;
    });
  }

  onSearchChange(term: string): void {
    this.searchTerm = term;
    this.applyFilters();
  }

  onTypeFilterChange(type: string): void {
    this.selectedType = type;
    this.applyFilters();
  }

  onStatusFilterChange(status: string): void {
    this.selectedStatus = status;
    this.applyFilters();
  }

  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'cards' ? 'table' : 'cards';
  }

  openCreateModal(): void {
    console.log('Opening create modal...');
    try {
      const dialogRef = this.dialog.open(ProcessFormModalComponent, {
        width: '600px',
        maxHeight: '90vh',
        data: { process: null, isEdit: false },
        disableClose: false
      });

      dialogRef.afterClosed().subscribe(result => {
        console.log('Dialog closed with result:', result);
        if (result) {
          this.processService.createProcess(result).subscribe({
            next: (newProcess) => {
              this.processes.push(newProcess);
              this.applyFilters();
              this.toastService.showSuccess(`Processus "${newProcess.name}" créé avec succès !`);
            },
            error: (error) => {
              this.toastService.showError('Erreur lors de la création du processus');
              console.error('Error creating process:', error);
            }
          });
        }
      });
    } catch (error) {
      console.error('Error opening create modal:', error);
      this.toastService.showError('Erreur lors de l\'ouverture de la modale');
    }
  }

  openEditModal(process: Process): void {
    console.log('Opening edit modal for process:', process);
    try {
      const dialogRef = this.dialog.open(ProcessFormModalComponent, {
        width: '600px',
        maxHeight: '90vh',
        data: { process: { ...process }, isEdit: true },
        disableClose: false
      });

      dialogRef.afterClosed().subscribe(result => {
        console.log('Edit dialog closed with result:', result);
        if (result && process.id) {
          this.processService.updateProcess(process.id, result).subscribe({
            next: (updatedProcess) => {
              const index = this.processes.findIndex(p => p.id === process.id);
              if (index !== -1) {
                this.processes[index] = updatedProcess;
                this.applyFilters();
              }
              this.toastService.showSuccess(`Processus "${updatedProcess.name}" modifié avec succès !`);
            },
            error: (error) => {
              this.toastService.showError('Erreur lors de la modification du processus');
              console.error('Error updating process:', error);
            }
          });
        }
      });
    } catch (error) {
      console.error('Error opening edit modal:', error);
      this.toastService.showError('Erreur lors de l\'ouverture de la modale');
    }
  }

  confirmDelete(process: Process): void {
    console.log('Confirming delete for process:', process);
    try {
      const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        width: '400px',
        data: {
          title: 'Supprimer le processus',
          message: `Êtes-vous sûr de vouloir supprimer le processus "${process.name}" (${process.code}) ?`,
          confirmText: 'Supprimer',
          cancelText: 'Annuler'
        }
      });

      dialogRef.afterClosed().subscribe(result => {
        console.log('Confirm dialog closed with result:', result);
        if (result && process.id) {
          this.processService.deleteProcess(process.id).subscribe({
            next: () => {
              this.processes = this.processes.filter(p => p.id !== process.id);
              this.applyFilters();
              this.toastService.showSuccess(`Processus "${process.name}" supprimé avec succès !`);
            },
            error: (error) => {
              this.toastService.showError('Erreur lors de la suppression du processus');
              console.error('Error deleting process:', error);
            }
          });
        }
      });
    } catch (error) {
      console.error('Error opening confirm dialog:', error);
      this.toastService.showError('Erreur lors de l\'ouverture de la confirmation');
    }
  }

  getCardClass(status: ProcessStatus): string {
    switch (status) {
      case ProcessStatus.CONFORME:
        return 'clr-green';
      case ProcessStatus.A_SURVEILLER:
        return 'clr-yellow';
      case ProcessStatus.NON_CONFORME:
        return 'clr-red';
      default:
        return '';
    }
  }

  getScoreColor(score: number): string {
    if (score >= 80) return 'var(--s-green)';
    if (score >= 60) return 'var(--s-yellow)';
    return 'var(--s-red)';
  }

  getStatusIcon(status: ProcessStatus): string {
    switch (status) {
      case ProcessStatus.CONFORME:
        return '●';
      case ProcessStatus.A_SURVEILLER:
        return '⚠';
      case ProcessStatus.NON_CONFORME:
        return '✕';
      default:
        return '';
    }
  }
}