import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { Process, ProcessType, ProcessStatus, ReviewFrequency } from '../../shared/models/process.model';

@Injectable({
  providedIn: 'root'
})
export class ProcessService {
  private processes: Process[] = [
    {
      id: 1,
      code: 'P-01',
      name: 'Management de la qualité',
      type: ProcessType.PILOTAGE,
      objective: 'Assurer la planification, la mise en œuvre et l\'amélioration continue du système de management de la qualité',
      pilot: 'A. Mansouri',
      reviewFrequency: ReviewFrequency.TRIMESTRIELLE,
      createdDate: '2024-01-15',
      nextReview: '2026-05-15',
      conformityScore: 94,
      status: ProcessStatus.CONFORME,
      kpis: ['Taux de conformité audits', 'Nombre d\'actions correctives'],
      clauseISO: '§5 - Leadership',
      proceduresCount: 5,
      documentsCount: 3
    },
    {
      id: 2,
      code: 'P-04',
      name: 'Réalisation du produit',
      type: ProcessType.OPERATIONNEL,
      objective: 'Maîtriser toutes les étapes de réalisation du produit depuis la conception jusqu\'à la livraison',
      pilot: 'S. Ben Ali',
      reviewFrequency: ReviewFrequency.SEMESTRIELLE,
      createdDate: '2024-01-20',
      nextReview: '2026-07-20',
      conformityScore: 82,
      status: ProcessStatus.CONFORME,
      kpis: ['Taux de conformité produit', 'Délai de livraison'],
      clauseISO: '§8 - Réalisation',
      proceduresCount: 8,
      documentsCount: 12
    },
    {
      id: 3,
      code: 'P-02',
      name: 'Achats et fournisseurs',
      type: ProcessType.OPERATIONNEL,
      objective: 'Assurer la sélection, l\'évaluation et le suivi des fournisseurs pour garantir la qualité des achats',
      pilot: 'K. Mrad',
      reviewFrequency: ReviewFrequency.SEMESTRIELLE,
      createdDate: '2024-01-18',
      nextReview: '2026-07-18',
      conformityScore: 71,
      status: ProcessStatus.A_SURVEILLER,
      kpis: ['Taux de conformité fournisseurs', 'Délai de livraison'],
      clauseISO: '§8 - Réalisation',
      proceduresCount: 4,
      documentsCount: 6
    },
    {
      id: 4,
      code: 'P-07',
      name: 'Étalonnage & métrologie',
      type: ProcessType.SUPPORT,
      objective: 'Garantir la fiabilité et la traçabilité des mesures par un système d\'étalonnage efficace',
      pilot: 'R. Haddad',
      reviewFrequency: ReviewFrequency.ANNUELLE,
      createdDate: '2024-02-01',
      nextReview: '2027-02-01',
      conformityScore: 58,
      status: ProcessStatus.NON_CONFORME,
      kpis: ['Taux d\'étalonnage à jour', 'Nombre d\'écarts métrologie'],
      clauseISO: '§7 - Support',
      proceduresCount: 3,
      documentsCount: 4
    },
    {
      id: 5,
      code: 'P-11',
      name: 'Satisfaction client',
      type: ProcessType.MESURE,
      objective: 'Mesurer et améliorer la satisfaction des clients par des enquêtes et le traitement des réclamations',
      pilot: 'A. Mansouri',
      reviewFrequency: ReviewFrequency.TRIMESTRIELLE,
      createdDate: '2024-01-25',
      nextReview: '2026-04-25',
      conformityScore: 89,
      status: ProcessStatus.CONFORME,
      kpis: ['Taux de satisfaction client', 'Délai de traitement réclamations'],
      clauseISO: '§9 - Évaluation',
      proceduresCount: 3,
      documentsCount: 5
    }
  ];

  private nextId = 6;

  getProcesses(): Observable<Process[]> {
    return of([...this.processes]).pipe(delay(300));
  }

  getProcess(id: number): Observable<Process> {
    const process = this.processes.find(p => p.id === id);
    if (process) {
      return of({ ...process }).pipe(delay(200));
    }
    return throwError(() => new Error('Processus non trouvé'));
  }

  createProcess(process: Omit<Process, 'id'>): Observable<Process> {
    const newProcess: Process = {
      ...process,
      id: this.nextId++
    };
    this.processes.push(newProcess);
    return of({ ...newProcess }).pipe(delay(500));
  }

  updateProcess(id: number, process: Partial<Process>): Observable<Process> {
    const index = this.processes.findIndex(p => p.id === id);
    if (index !== -1) {
      this.processes[index] = { ...this.processes[index], ...process };
      return of({ ...this.processes[index] }).pipe(delay(500));
    }
    return throwError(() => new Error('Processus non trouvé'));
  }

  deleteProcess(id: number): Observable<void> {
    const index = this.processes.findIndex(p => p.id === id);
    if (index !== -1) {
      this.processes.splice(index, 1);
      return of(void 0).pipe(delay(300));
    }
    return throwError(() => new Error('Processus non trouvé'));
  }

  getProcessesByType(type: ProcessType): Observable<Process[]> {
    return this.getProcesses().pipe(
      map(processes => processes.filter(p => p.type === type))
    );
  }

  getProcessesByStatus(status: ProcessStatus): Observable<Process[]> {
    return this.getProcesses().pipe(
      map(processes => processes.filter(p => p.status === status))
    );
  }
}