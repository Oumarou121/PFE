import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";

declare const DB: any;
declare const requireAuth: any;

@Injectable({
  providedIn: "root",
})
export class DbService {
  private _state = new BehaviorSubject<any>({});
  public state$ = this._state.asObservable();

  constructor() {}

  async requireAuth(options?: any): Promise<any> {
    if (typeof requireAuth !== "undefined") {
      return await requireAuth(options);
    }
    throw new Error(
      "requireAuth from legacy not found. Make sure shared.js is loaded.",
    );
  }

  setContext(context: any = {}): void {
    if (typeof DB !== "undefined") {
      DB.setContext(context);
    }
  }

  async ensureResources(
    resources: string[] = [],
    options: any = {},
  ): Promise<void> {
    if (typeof DB !== "undefined") {
      const result = await DB.ensureResources(resources, options);
      this.updateState(resources);
      return result;
    }
    throw new Error("DB from legacy not found.");
  }

  getResourceState(name: string): any {
    if (typeof DB !== "undefined") {
      return DB.getResourceState(name);
    }
    throw new Error("DB from legacy not found.");
  }

  async getStableResource(name: string): Promise<any> {
    if (typeof DB !== "undefined") {
      return await DB.getStableResource(name);
    }
    throw new Error("DB from legacy not found.");
  }

  // --- WRAPPERS POUR LES FONCTIONS LEGACY DE MODIFICATION ---

  getTemplate(id: string | number): any {
    if (typeof DB !== "undefined" && DB.getTemplate) {
      return DB.getTemplate(id);
    }
    return null;
  }

  saveTemplate(tpl: any): void {
    if (typeof DB !== "undefined" && DB.saveTemplate) {
      DB.saveTemplate(tpl);
      this.updateState(["templates"]); // Notifier l'UI Angular que ça a changé
    }
  }

  private updateState(resources: string[]) {
    const currentState = this._state.value;
    resources.forEach((res) => {
      currentState[res] = this.getResourceState(res);
    });
    this._state.next({ ...currentState });
  }
}
