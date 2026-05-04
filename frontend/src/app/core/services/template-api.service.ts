import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TemplateApiService {
  private apiUrl = \\/templates\;

  constructor(private http: HttpClient) {}

  getAllTemplates(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  getTemplateById(id: string): Observable<any> {
    return this.http.get<any>(\\/\\);
  }

  saveTemplate(template: any): Observable<any> {
    // Le C# backend a une route POST sur /api/templates pour le Upsert (Create/Update)
    return this.http.post<any>(this.apiUrl, template);
  }
}
