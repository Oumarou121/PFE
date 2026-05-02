export interface Process {
  id?: number;
  code: string;
  name: string;
  type: ProcessType;
  objective: string;
  pilot: string;
  reviewFrequency: ReviewFrequency;
  createdDate: string;
  nextReview: string;
  conformityScore: number;
  status: ProcessStatus;
  kpis: string[];
  clauseISO?: string;
  proceduresCount?: number;
  documentsCount?: number;
}

export enum ProcessType {
  PILOTAGE = 'Processus de pilotage',
  OPERATIONNEL = 'Processus opérationnel',
  SUPPORT = 'Processus support',
  MESURE = 'Processus de mesure'
}

export enum ReviewFrequency {
  MENSUELLE = 'Mensuelle',
  TRIMESTRIELLE = 'Trimestrielle',
  SEMESTRIELLE = 'Semestrielle',
  ANNUELLE = 'Annuelle'
}

export enum ProcessStatus {
  CONFORME = 'Conforme',
  A_SURVEILLER = 'À surveiller',
  NON_CONFORME = 'Non conforme'
}

export interface Document {
  id?: number;
  ref: string;
  name: string;
  type: DocumentType;
  processCode: string;
  status: DocumentStatus;
  version: string;
  updatedDate: string;
  owner: string;
}

export enum DocumentType {
  MANUEL = 'Manuel',
  PROCEDURE = 'Procédure',
  ENREGISTREMENT = 'Enregistrement',
  FORMULAIRE = 'Formulaire'
}

export enum DocumentStatus {
  APPROUVE = 'Approuvé',
  EN_REVISION = 'En révision',
  PERIME = 'Périmé'
}

export interface NonConformity {
  id?: number;
  ref: string;
  description: string;
  processCode: string;
  priority: Priority;
  progress: number;
  responsible: string;
  createdDate: string;
  dueDate: string;
  status: NCStatus;
}

export enum Priority {
  ELEVEE = 'Élevée',
  MOYENNE = 'Moyenne',
  FAIBLE = 'Faible'
}

export enum NCStatus {
  OUVERTE = 'Ouverte',
  EN_COURS = 'En cours',
  FERMEE = 'Fermée'
}