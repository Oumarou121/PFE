import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ProcessService } from '../../core/services/process.service';
import { Process, ProcessStatus } from '../../shared/models/process.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  processes: Process[] = [];
  nonConformities = [
    {
      ref: 'NC-031',
      description: 'Écart de traçabilité',
      processCode: 'P-04',
      priority: 'Élevée',
      progress: 20,
      responsible: 'R. Haddad'
    },
    {
      ref: 'NC-028',
      description: 'Calibration non conforme',
      processCode: 'P-07',
      priority: 'Élevée',
      progress: 55,
      responsible: 'A. Mansouri'
    },
    {
      ref: 'NC-025',
      description: 'Délai fournisseur dépassé',
      processCode: 'P-02',
      priority: 'Moyenne',
      progress: 70,
      responsible: 'K. Mrad'
    },
    {
      ref: 'NC-022',
      description: 'Formation manquante',
      processCode: 'P-11',
      priority: 'Faible',
      progress: 90,
      responsible: 'S. Ben Ali'
    }
  ];

  constructor(private processService: ProcessService) {}

  ngOnInit(): void {
    this.loadProcesses();
  }

  loadProcesses(): void {
    this.processService.getProcesses().subscribe({
      next: (processes) => {
        this.processes = processes.slice(0, 5); // Show only first 5
      },
      error: (error) => {
        console.error('Error loading processes:', error);
      }
    });
  }

  getProcessTypeShort(type: string): string {
    switch (type) {
      case 'Processus de pilotage':
        return 'Pilotage';
      case 'Processus opérationnel':
        return 'Opérationnel';
      case 'Processus support':
        return 'Support';
      case 'Processus de mesure':
        return 'Mesure';
      default:
        return type;
    }
  }

  getScoreColor(score: number): string {
    if (score >= 80) return 'var(--s-green)';
    if (score >= 60) return 'var(--s-yellow)';
    return 'var(--s-red)';
  }

  getStatusClass(status: ProcessStatus): string {
    switch (status) {
      case ProcessStatus.CONFORME:
        return 'conforme';
      case ProcessStatus.A_SURVEILLER:
        return 'revision';
      case ProcessStatus.NON_CONFORME:
        return 'perime';
      default:
        return '';
    }
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

  getPriorityClass(priority: string): string {
    switch (priority) {
      case 'Élevée':
        return 'perime';
      case 'Moyenne':
        return 'revision';
      case 'Faible':
        return 'conforme';
      default:
        return '';
    }
  }

  getProgressColor(progress: number): string {
    if (progress >= 80) return 'var(--s-green)';
    if (progress >= 50) return 'var(--s-yellow)';
    return 'var(--s-red)';
  }
}