import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { AdminFamily, AdminService, AdminTemplate, AdminVm } from './admin.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule],
  providers: [AdminService],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit {
  loading = true;
  error = '';
  families: AdminFamily[] = [];
  templates: AdminTemplate[] = [];
  selectedFamilyId: string | null = null;
  states: Partial<AdminVm['states']> = {};

  constructor(private readonly adminService: AdminService) {}

  async ngOnInit(): Promise<void> {
    try {
      const vm = await this.adminService.load();
      this.families = vm.families;
      this.templates = vm.templates;
      this.states = vm.states;
      this.selectedFamilyId = this.families[0]?.id ?? null;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Chargement impossible';
    } finally {
      this.loading = false;
    }
  }

  get selectedFamily(): AdminFamily | null {
    return this.families.find(family => family.id === this.selectedFamilyId) ?? null;
  }

  get visibleTemplates(): AdminTemplate[] {
    return this.selectedFamilyId
      ? this.templates.filter(template => template.familyId === this.selectedFamilyId)
      : this.templates;
  }

  selectFamily(family: AdminFamily): void {
    this.selectedFamilyId = family.id;
  }
}
