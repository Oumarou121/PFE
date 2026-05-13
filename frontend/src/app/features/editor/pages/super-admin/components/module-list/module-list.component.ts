import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModuleRecord as Module } from '../../../../models/module.model';

@Component({
  selector: 'app-module-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="list-item" *ngFor="let module of modules" 
         [class.active]="selectedId === module.id"
         (click)="onSelect(module.id)">
      <div class="list-item-icon">🧩</div>
      <div class="list-item-body">
        <div class="list-item-name">{{ module.name }}</div>
        <div class="list-item-meta">{{ module.tableViews.length }} tables</div>
      </div>
      <div class="list-item-actions">
         <span class="badge" *ngIf="!module.isActive">Inactif</span>
      </div>
    </div>
  `,
  styles: [`
    .list-item {
      padding: 12px;
      border-bottom: 1px solid var(--border);
      cursor: pointer;
      display: flex;
      align-items: center;
      transition: background 0.2s;
    }
    .list-item:hover { background: var(--bg-hover); }
    .list-item.active { background: var(--bg-active); border-left: 3px solid var(--purple); }
    .list-item-icon { font-size: 20px; margin-right: 12px; }
    .list-item-body { flex: 1; }
    .list-item-name { font-weight: 600; color: var(--text-main); font-size: 14px; }
    .list-item-meta { font-size: 12px; color: var(--text-muted); }
    .badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: #fee2e2; color: #b91c1c; }
  `]
})
export class ModuleListComponent {
  @Input() modules: Module[] = [];
  @Input() selectedId: string | null = null;
  @Output() select = new EventEmitter<string>();

  onSelect(id: string): void {
    this.select.emit(id);
  }
}
