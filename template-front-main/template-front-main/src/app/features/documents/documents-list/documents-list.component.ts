import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Document, DocumentType, DocumentStatus } from '../../../shared/models/process.model';

@Component({
  selector: 'app-documents-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './documents-list.component.html',
  styleUrls: ['./documents-list.component.scss']
})
export class DocumentsListComponent implements OnInit {
  documents: Document[] = [];
  filteredDocuments: Document[] = [];
  paginatedDocuments: Document[] = [];
  
  searchTerm = '';
  typeFilter = 'all';
  statusFilter = 'all';
  
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;
  startIndex = 0;
  endIndex = 0;

  private ownerColors: { [key: string]: string } = {
    'A. Mansouri': 'var(--xl-green-mid)',
    'K. Mrad': '#6C3483',
    'S. Ben Ali': '#1A5276',
    'R. Haddad': '#9B1C1C'
  };

  ngOnInit(): void {
    this.loadDocuments();
  }

  loadDocuments(): void {
    // Mock data - replace with actual service call
    this.documents = [
      { id: 1, ref: 'MQ-001', name: 'Manuel Qualité', type: DocumentType.MANUEL, processCode: 'P-01', status: DocumentStatus.APPROUVE, version: 'v3.2', updatedDate: '15/01/2026', owner: 'A. Mansouri' },
      { id: 2, ref: 'PRO-001', name: 'Maîtrise des documents', type: DocumentType.PROCEDURE, processCode: 'P-01', status: DocumentStatus.APPROUVE, version: 'v2.0', updatedDate: '10/01/2026', owner: 'A. Mansouri' },
      { id: 3, ref: 'PRO-002', name: 'Maîtrise des enregistrements', type: DocumentType.PROCEDURE, processCode: 'P-01', status: DocumentStatus.APPROUVE, version: 'v1.8', updatedDate: '10/01/2026', owner: 'K. Mrad' },
      { id: 4, ref: 'PRO-003', name: 'Audit interne', type: DocumentType.PROCEDURE, processCode: 'P-01', status: DocumentStatus.EN_REVISION, version: 'v2.1', updatedDate: '05/01/2026', owner: 'A. Mansouri' },
      { id: 5, ref: 'ENR-001', name: 'Registre des audits', type: DocumentType.ENREGISTREMENT, processCode: 'P-01', status: DocumentStatus.APPROUVE, version: 'v1.0', updatedDate: '01/02/2026', owner: 'A. Mansouri' },
      { id: 6, ref: 'FOR-001', name: 'Fiche d\'action corrective', type: DocumentType.FORMULAIRE, processCode: 'P-01', status: DocumentStatus.APPROUVE, version: 'v2.0', updatedDate: '01/01/2026', owner: 'A. Mansouri' },
      { id: 7, ref: 'ENR-024', name: 'Enregistrements audits internes', type: DocumentType.ENREGISTREMENT, processCode: 'P-01', status: DocumentStatus.PERIME, version: 'v1.0', updatedDate: '15/06/2025', owner: 'K. Mrad' },
      { id: 8, ref: 'PRO-007', name: 'Qualification fournisseurs', type: DocumentType.PROCEDURE, processCode: 'P-02', status: DocumentStatus.APPROUVE, version: 'v1.2', updatedDate: '08/12/2025', owner: 'K. Mrad' },
      { id: 9, ref: 'FOR-003', name: 'Bon de commande standard', type: DocumentType.FORMULAIRE, processCode: 'P-02', status: DocumentStatus.EN_REVISION, version: 'v1.4', updatedDate: '15/12/2025', owner: 'K. Mrad' },
      { id: 10, ref: 'PRO-011', name: 'Réception et inspection', type: DocumentType.PROCEDURE, processCode: 'P-04', status: DocumentStatus.APPROUVE, version: 'v2.2', updatedDate: '15/11/2025', owner: 'S. Ben Ali' }
    ];
    
    this.filterDocuments();
  }

  filterDocuments(): void {
    this.filteredDocuments = this.documents.filter(doc => {
      const matchesSearch = !this.searchTerm || 
        doc.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        doc.ref.toLowerCase().includes(this.searchTerm.toLowerCase());
      
      const matchesType = this.typeFilter === 'all' || doc.type === this.typeFilter;
      const matchesStatus = this.statusFilter === 'all' || doc.status === this.statusFilter;
      
      return matchesSearch && matchesType && matchesStatus;
    });
    
    this.updatePagination();
  }

  setTypeFilter(type: string): void {
    this.typeFilter = type;
    this.currentPage = 1;
    this.filterDocuments();
  }

  setStatusFilter(status: string): void {
    this.statusFilter = status;
    this.currentPage = 1;
    this.filterDocuments();
  }

  updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredDocuments.length / this.itemsPerPage);
    this.startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.endIndex = Math.min(this.startIndex + this.itemsPerPage, this.filteredDocuments.length);
    
    this.paginatedDocuments = this.filteredDocuments.slice(this.startIndex, this.endIndex);
  }

  goToPage(page: number): void {
    this.currentPage = page;
    this.updatePagination();
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.totalPages, start + maxVisible - 1);
    
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  sortBy(field: string): void {
    // Implement sorting logic
    console.log('Sort by:', field);
  }

  getDocIconClass(type: DocumentType): string {
    switch (type) {
      case DocumentType.MANUEL:
        return 'manuel';
      case DocumentType.PROCEDURE:
        return 'proc';
      case DocumentType.ENREGISTREMENT:
        return 'enreg';
      case DocumentType.FORMULAIRE:
        return 'form';
      default:
        return 'proc';
    }
  }

  getDocIcon(type: DocumentType): string {
    switch (type) {
      case DocumentType.MANUEL:
        return '<path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>';
      case DocumentType.PROCEDURE:
        return '<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 5h6m-3 4v6m-3-3h6"/>';
      case DocumentType.ENREGISTREMENT:
        return '<path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>';
      case DocumentType.FORMULAIRE:
        return '<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 5h6m-5 6l2 2 4-4"/>';
      default:
        return '<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 5h6m-3 4v6m-3-3h6"/>';
    }
  }

  getTypeClass(type: DocumentType): string {
    switch (type) {
      case DocumentType.MANUEL:
        return 'purple';
      case DocumentType.PROCEDURE:
        return 'blue';
      case DocumentType.ENREGISTREMENT:
        return 'orange';
      case DocumentType.FORMULAIRE:
        return 'green-t';
      default:
        return 'blue';
    }
  }

  getStatusClass(status: DocumentStatus): string {
    switch (status) {
      case DocumentStatus.APPROUVE:
        return 'conforme';
      case DocumentStatus.EN_REVISION:
        return 'revision';
      case DocumentStatus.PERIME:
        return 'perime';
      default:
        return '';
    }
  }

  getStatusIcon(status: DocumentStatus): string {
    switch (status) {
      case DocumentStatus.APPROUVE:
        return '●';
      case DocumentStatus.EN_REVISION:
        return '⏳';
      case DocumentStatus.PERIME:
        return '✕';
      default:
        return '';
    }
  }

  getOwnerColor(owner: string): string {
    return this.ownerColors[owner] || 'var(--xl-green-mid)';
  }

  getOwnerInitials(owner: string): string {
    return owner.split(' ').map(n => n[0]).join('').toUpperCase();
  }
}