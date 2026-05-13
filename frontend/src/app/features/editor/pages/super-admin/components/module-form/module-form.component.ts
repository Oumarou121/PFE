import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModuleRecord as Module, ModuleTableView } from '../../../../models/module.model';
import { TableViewConfig } from '../../../../models/table-view.model';
import { OrganizationRecord } from '../../../../models/organization.model';

@Component({
  selector: 'app-module-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="module-form">
      <div class="form-header">
        <h2>{{ module.id ? 'Modifier le Module' : 'Nouveau Module' }}</h2>
        <div class="header-actions">
           <button class="btn-secondary" (click)="onCancel()">Annuler</button>
           <button class="btn-primary" (click)="onSave()">Enregistrer</button>
        </div>
      </div>

      <div class="form-body">
        <section class="form-section">
          <h3>Informations générales</h3>
          <div class="form-group">
            <label>Nom du module</label>
            <input type="text" [(ngModel)]="draft.name" placeholder="Ex: Teachers, Etudiants...">
          </div>
          <div class="form-group">
            <label>Icône (Emoji ou code)</label>
            <input type="text" [(ngModel)]="draft.icon" placeholder="Ex: 🧩, 🎓, teachers...">
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea [(ngModel)]="draft.description" rows="2"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Ordre d'affichage</label>
              <input type="number" [(ngModel)]="draft.displayOrder">
            </div>
            <div class="form-group flex-row">
               <label class="checkbox-container">
                  <input type="checkbox" [(ngModel)]="draft.isActive">
                  <span class="checkmark"></span>
                  Module actif
               </label>
            </div>
          </div>
        </section>

        <section class="form-section">
          <h3>Organisations autorisées</h3>
          <div class="org-selector">
            <label *ngFor="let org of organizations" class="checkbox-container">
              <input type="checkbox" 
                     [checked]="draft.organizationIds.includes(asNumber(org.id))"
                     (change)="toggleOrg(org.id)">
              <span class="checkmark"></span>
              {{ org.nom || org.name }}
            </label>
            <div *ngIf="draft.organizationIds.length === 0" class="info-text">
              Aucune organisation sélectionnée : visible par tous par défaut.
            </div>
          </div>
        </section>

        <section class="form-section">
          <div class="section-header">
            <h3>Tables de données (TableView)</h3>
            <button class="btn-add" (click)="addTableView()">+ Ajouter une table</button>
          </div>
          
          <div class="table-views-list">
            <div *ngFor="let mtv of draft.tableViews; let i = index" class="mtv-item">
              <div class="mtv-drag">⋮⋮</div>
              <div class="mtv-config">
                <select [(ngModel)]="mtv.tableViewConfigId" (change)="onTableViewChange(mtv)">
                  <option value="">-- Sélectionner une table --</option>
                  <option *ngFor="let tv of availableTableViews" [value]="tv.id">
                    {{ tv.label }} ({{ tv.tableName }})
                  </option>
                </select>
              </div>
              <div class="mtv-options">
                <label class="radio-container">
                  <input type="radio" name="mainTv" [checked]="mtv.isPrimary" (change)="setMainTableView(mtv)">
                  <span class="radio-mark"></span>
                  Principal
                </label>
                <label class="checkbox-container">
                  <input type="checkbox" [(ngModel)]="mtv.isManagementTable">
                  <span class="checkmark"></span>
                  Gestion
                </label>
              </div>
              <button class="btn-remove" (click)="removeTableView(i)">×</button>
            </div>
            <div *ngIf="draft.tableViews.length === 0" class="empty-state">
              Aucune table ajoutée à ce module.
            </div>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [`
    .module-form { padding: 24px; background: white; height: 100%; overflow-y: auto; }
    .form-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; border-bottom: 1px solid var(--border); padding-bottom: 16px; }
    .form-header h2 { margin: 0; font-size: 20px; color: var(--text-main); }
    .header-actions { display: flex; gap: 12px; }
    .form-body { display: flex; flex-direction: column; gap: 32px; max-width: 800px; }
    .form-section h3 { margin: 0 0 16px 0; font-size: 14px; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; }
    .form-group { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
    .form-group label { font-size: 13px; font-weight: 600; color: var(--text-main); }
    .form-row { display: flex; gap: 24px; }
    .flex-row { flex-direction: row; align-items: center; padding-top: 24px; }
    input[type="text"], input[type="number"], textarea, select {
      padding: 10px; border: 1px solid var(--border); border-radius: 6px; font-size: 14px;
    }
    textarea { resize: vertical; }

    .org-selector { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; padding: 16px; background: var(--bg-light); border-radius: 8px; }
    .info-text { grid-column: 1 / -1; font-size: 12px; color: var(--text-muted); font-style: italic; }

    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .btn-add { background: none; border: 1px dashed var(--purple); color: var(--purple); padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600; }
    .btn-add:hover { background: #f5f3ff; }

    .table-views-list { display: flex; flex-direction: column; gap: 8px; }
    .mtv-item { display: flex; align-items: center; gap: 12px; padding: 12px; background: white; border: 1px solid var(--border); border-radius: 8px; }
    .mtv-drag { color: var(--text-muted); cursor: grab; font-size: 18px; }
    .mtv-config { flex: 1; }
    .mtv-config select { width: 100%; }
    .mtv-options { display: flex; gap: 16px; }
    .btn-remove { background: none; border: none; font-size: 20px; color: var(--text-muted); cursor: pointer; padding: 0 8px; }
    .btn-remove:hover { color: #ef4444; }

    /* Custom controls */
    .checkbox-container, .radio-container { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; position: relative; }
    .checkmark, .radio-mark { height: 18px; width: 18px; background-color: #eee; border-radius: 4px; }
    .radio-mark { border-radius: 50%; }
    .checkbox-container:hover input ~ .checkmark { background-color: #ccc; }
    .checkbox-container input:checked ~ .checkmark { background-color: var(--purple); }
    .radio-container input:checked ~ .radio-mark { background-color: var(--purple); }
    input[type="checkbox"], input[type="radio"] { position: absolute; opacity: 0; cursor: pointer; height: 0; width: 0; }

    .empty-state { padding: 32px; text-align: center; border: 1px dashed var(--border); border-radius: 8px; color: var(--text-muted); font-size: 13px; }

    .btn-primary { background: var(--purple); color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; }
    .btn-secondary { background: white; border: 1px solid var(--border); padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; }
  `]
})
export class ModuleFormComponent implements OnInit {
  @Input() module!: Module;
  @Input() availableTableViews: TableViewConfig[] = [];
  @Input() organizations: OrganizationRecord[] = [];
  
  @Output() save = new EventEmitter<Module>();
  @Output() cancel = new EventEmitter<void>();

  draft!: Module;

  ngOnInit() {
    this.draft = JSON.parse(JSON.stringify(this.module));
    if (!this.draft.organizationIds) this.draft.organizationIds = [];
    if (!this.draft.tableViews) this.draft.tableViews = [];
  }

  toggleOrg(id: any) {
    const orgId = Number(id);
    const idx = this.draft.organizationIds.indexOf(orgId);
    if (idx === -1) this.draft.organizationIds.push(orgId);
    else this.draft.organizationIds.splice(idx, 1);
  }

  asNumber(val: any): number {
    return Number(val);
  }

  addTableView() {
    this.draft.tableViews.push({
      id: '',
      moduleId: this.draft.id,
      tableViewConfigId: '',
      isPrimary: this.draft.tableViews.length === 0,
      isManagementTable: false,
      orderIndex: this.draft.tableViews.length
    });
  }

  removeTableView(index: number) {
    const wasPrimary = this.draft.tableViews[index].isPrimary;
    this.draft.tableViews.splice(index, 1);
    if (wasPrimary && this.draft.tableViews.length > 0) {
      this.draft.tableViews[0].isPrimary = true;
      this.draft.mainTableViewId = this.draft.tableViews[0].tableViewConfigId;
    }
  }

  setMainTableView(mtv: ModuleTableView) {
    this.draft.tableViews.forEach(t => t.isPrimary = false);
    mtv.isPrimary = true;
    this.draft.mainTableViewId = mtv.tableViewConfigId;
  }

  onTableViewChange(mtv: ModuleTableView) {
    if (mtv.isPrimary) {
      this.draft.mainTableViewId = mtv.tableViewConfigId;
    }
  }

  onSave() {
    // Validation
    if (!this.draft.name.trim()) {
      alert("Le nom est obligatoire");
      return;
    }
    if (this.draft.tableViews.length === 0) {
      alert("Ajoutez au moins une table");
      return;
    }
    if (!this.draft.mainTableViewId) {
      const primary = this.draft.tableViews.find(t => t.isPrimary);
      if (primary) this.draft.mainTableViewId = primary.tableViewConfigId;
      else {
        alert("Sélectionnez une table principale");
        return;
      }
    }
    
    this.save.emit(this.draft);
  }

  onCancel() {
    this.cancel.emit();
  }
}
