import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable, firstValueFrom } from "rxjs";
import { ApiService } from "../../../core/services/api.service";
import {
  BootstrapResponse,
  EditorListResponse,
  EditorResource,
  EditorState,
  UnknownRecord,
} from "../models/editor-common.model";
import {
  normalizeFamilyRecord,
  normalizeOrganizationRecord,
  normalizeState,
  normalizeTableViewRecord,
  normalizeTemplateRecord,
} from "./editor-normalizers";

@Injectable({ providedIn: "root" })
export class EditorStateService {
  private state: EditorState = normalizeState();
  private stateSubject = new BehaviorSubject<EditorState>(this.state);
  public state$ = this.stateSubject.asObservable();

  private readyPromise: Promise<EditorState> | null = null;
  private resourcePromises: Partial<
    Record<EditorResource, Promise<EditorState> | null>
  > = {};

  constructor(private api: ApiService) {}

  async loadBootstrap(force = false): Promise<EditorState> {
    if (this.readyPromise && !force) return this.readyPromise;
    this.readyPromise = firstValueFrom(
      this.api.post<BootstrapResponse>("bootstrap", {}),
    )
      .then((payload) => {
        this.state = normalizeState(payload.state);
        this.state._loaded = {
          families: true,
          templates: true,
          organizations: true,
          admins: true,
          tableViews: true,
          modules: true,
          settings: true,
        };
        this.stateSubject.next(this.getState());
        return this.getState();
      })
      .catch(() => {
        this.state = normalizeState();
        this.stateSubject.next(this.getState());
        return this.getState();
      });
    return this.readyPromise;
  }

  getState(): EditorState {
    return normalizeState(this.state);
  }

  replaceState(state: Partial<EditorState>): EditorState {
    const loaded = this.state._loaded || {};
    this.state = normalizeState(state);
    this.state._loaded = { ...loaded };
    this.stateSubject.next(this.getState());
    return this.getState();
  }

  patchState(patch: Partial<EditorState>): EditorState {
    this.state = normalizeState({ ...this.state, ...patch });
    this.stateSubject.next(this.getState());
    return this.getState();
  }

  async persistState(
    statePatch: Partial<EditorState> = {},
  ): Promise<EditorState> {
    // On calcule le prochain etat potentiel
    const nextState = normalizeState({ ...this.state, ...statePatch });

    // On tente la persistance cote serveur
    await firstValueFrom(this.api.put("state", { state: nextState }));

    // Si ca reussit, on met a jour l'etat local
    const loaded = this.state._loaded || {};
    this.state = nextState;
    this.state._loaded = { ...loaded };
    this.stateSubject.next(this.getState());

    return this.getState();
  }

  async ensureResources(
    resources: EditorResource[] | EditorResource,
    options: { force?: boolean } = {},
  ): Promise<EditorState> {
    const raw = (Array.isArray(resources) ? resources : [resources]).filter(
      Boolean,
    );
    const requested = raw.filter((v, i) => raw.indexOf(v) === i);
    const missing = requested.filter(
      (name) => options.force || !this.state._loaded?.[name],
    );
    if (!missing.length) return this.getState();
    await Promise.all(
      missing.map((name) => this.loadResource(name, options.force)),
    );
    return this.getState();
  }

  setResourceLoaded(resource: EditorResource, loaded = true): void {
    this.state._loaded = { ...(this.state._loaded || {}), [resource]: loaded };
    this.stateSubject.next(this.getState());
  }

  public async loadResource(
    resource: EditorResource,
    force = false,
  ): Promise<EditorState> {
    if (this.resourcePromises[resource] && !force)
      return this.resourcePromises[resource]!;
    const endpoint = this.getResourceEndpoint(resource);
    if (!endpoint) return this.getState();
    this.resourcePromises[resource] = firstValueFrom(
      this.api.get<EditorListResponse<UnknownRecord> | UnknownRecord[]>(
        endpoint,
      ),
    )
      .then((payload) => {
        try {
          // Log payload shape to help debug non-iterable/incorrect responses
          // eslint-disable-next-line no-console
          console.debug(
            `EditorStateService: loadResource '${resource}' payload:`,
            payload,
          );

          const rows = Array.isArray(payload)
            ? payload
            : Array.isArray((payload as any)?.items)
              ? (payload as any).items
              : [];

          // Defensive mapping: wrap each assignment to surface mapping errors
          if (resource === "families")
            this.state.families = rows.map(normalizeFamilyRecord);
          if (resource === "templates")
            this.state.templates = rows.map(normalizeTemplateRecord);
          if (resource === "organizations")
            this.state.organizations = rows.map(normalizeOrganizationRecord);
          if (resource === "admins")
            this.state.admins = Array.isArray(rows) ? (rows as any[]) : [];
          if (resource === "tableViews")
            this.state.tableViews = Array.isArray(rows)
              ? rows.map(normalizeTableViewRecord)
              : [];
          if (resource === "modules")
            this.state.modules = Array.isArray(rows) ? (rows as any[]) : [];

          this.setResourceLoaded(resource, true);
          this.stateSubject.next(this.getState());
          return this.getState();
        } catch (mapErr) {
          try {
            // eslint-disable-next-line no-console
            console.error(
              `EditorStateService: failed while mapping resource '${resource}'`,
              mapErr,
            );
            // eslint-disable-next-line no-console
            console.error(
              "EditorStateService: payload (for inspection):",
              payload,
            );
          } catch {}
          throw mapErr;
        }
      })
      .catch((err) => {
        // Surface API errors for debugging in the browser console
        // Calling code will still receive the rejection; this just logs details.
        try {
          // eslint-disable-next-line no-console
          console.error(
            `EditorStateService: failed to load resource '${resource}' from '${endpoint}'`,
            err,
          );
        } catch {}
        throw err;
      })
      .finally(() => {
        this.resourcePromises[resource] = null;
      });
    return this.resourcePromises[resource]!;
  }

  private getResourceEndpoint(resource: EditorResource): string | null {
    const endpoints: Partial<Record<EditorResource, string>> = {
      families: "families",
      templates: "templates",
      organizations: "organizations",
      admins: "admins",
      tableViews: "table-view-configs",
      modules: "modules",
    };
    return endpoints[resource] || null;
  }
}
