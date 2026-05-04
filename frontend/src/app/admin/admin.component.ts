import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { DbService } from "../core/services/db.service";
import { BehaviorSubject, Observable } from "rxjs";
import { FormsModule } from "@angular/forms";

import { AdminEditorComponent } from "./admin-editor/admin-editor.component";

@Component({
  selector: "app-admin",
  standalone: true,
  imports: [CommonModule, FormsModule, AdminEditorComponent],
  providers: [DbService],
  templateUrl: "./admin.component.html",
  styleUrls: ["./admin.component.scss"],
})
export class AdminComponent implements OnInit {
  private _data = new BehaviorSubject<any>({ families: [], templates: [] });
  public data$ = this._data.asObservable();
  public state$: Observable<any>;

  public organizationLabel = "Organisation Admin";
  public isSidebarOpen = true;
  public isVarsPanelOpen = false;

  public selectedFamilyId: string | null = null;
  public selectedTemplateId: string | null = null;

  // MODALS STATE
  public modalTitle = "Nouveau template";
  public isTemplateModalOpen = false;
  public draftTemplateName = "";

  constructor(public db: DbService) {
    this.state$ = this.db.state$;
  }

  get visibleTemplates() {
    const d = this._data.value;
    if (!this.selectedFamilyId) return [];
    return d.templates.filter(
      (t: any) =>
        t.familyId === this.selectedFamilyId ||
        t.familyId === Number(this.selectedFamilyId),
    );
  }

  async ngOnInit(): Promise<void> {
    try {
      const session = await this.db.requireAuth({ role: "admin" });
      this.organizationLabel =
        session?.organizationName || "Organisation Admin";
      this.db.setContext({
        organizationId: session?.organizationId,
        role: "admin",
      });

      await this.db.ensureResources([
        "families",
        "templates",
        "organizations",
        "tableViews",
      ]);

      const familiesData = await this.db.getStableResource("families");
      const templatesData = await this.db.getStableResource("templates");

      this._data.next({
        families: familiesData || [],
        templates: templatesData || [],
      });
    } catch (err) {
      console.error("Failed to load admin context", err);
    }
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  toggleVarsPanel() {
    this.isVarsPanelOpen = !this.isVarsPanelOpen;
  }

  onFamChange() {
    this.selectedTemplateId = null;
    // Logique supplémentaire (cacher éditeur, etc.)
  }

  newTemplate() {
    if (!this.selectedFamilyId) {
      alert("Veuillez sélectionner une famille.");
      return;
    }
    this.draftTemplateName = "";
    this.isTemplateModalOpen = true;
  }

  cancelNewTemplate() {
    this.isTemplateModalOpen = false;
  }

  saveNewTemplate() {
    if (!this.draftTemplateName.trim()) {
      alert("Veuillez entrer un nom valide.");
      return;
    }
    // Simulation of adding to the list (in real life, needs an API push)
    const currentData = this._data.value;
    const newTpl = {
      id: Date.now(), // Fake ID
      nom: this.draftTemplateName,
      familyId: this.selectedFamilyId,
      version: "1.0",
    };
    this._data.next({
      ...currentData,
      templates: [...currentData.templates, newTpl],
    });
    this.selectedTemplateId = newTpl.id.toString();
    this.isTemplateModalOpen = false;
  }

  public selectedTemplateName: string = "";

  selectTemplate(template: any) {
    this.selectedTemplateId = template.id;
    this.selectedTemplateName = template.nom || template.name || "Sans Nom";
  }

  logout() {
    window.location.href = "/login.html"; // Redirection brute legacy (temporaire)
  }
}
