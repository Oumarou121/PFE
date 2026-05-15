import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { LoginRequest, LoginResponse, AuthUser } from '../../shared/models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'auth_user';
  private readonly ACADEMIC_YEAR_KEY = 'active_academic_year';

  private currentUserSubject = new BehaviorSubject<AuthUser | null>(this.getUserFromStorage());
  public currentUser$ = this.currentUserSubject.asObservable();

  private activeOrgIdSubject = new BehaviorSubject<string | null>(localStorage.getItem('active_org_id'));
  public activeOrgId$ = this.activeOrgIdSubject.asObservable();

  private activeAcademicYearSubject = new BehaviorSubject<string | null>(localStorage.getItem(this.ACADEMIC_YEAR_KEY));
  public activeAcademicYear$ = this.activeAcademicYearSubject.asObservable();

  constructor(
    private apiService: ApiService,
    private router: Router
  ) {}

  setActiveOrganizationId(id: string | null): void {
    if (id) localStorage.setItem('active_org_id', id);
    else localStorage.removeItem('active_org_id');
    this.activeOrgIdSubject.next(id);
  }

  getActiveOrganizationId(): string | null {
    return this.activeOrgIdSubject.value;
  }

  setActiveAcademicYear(code: string | null): void {
    if (code) localStorage.setItem(this.ACADEMIC_YEAR_KEY, code);
    else localStorage.removeItem(this.ACADEMIC_YEAR_KEY);
    this.activeAcademicYearSubject.next(code);
  }

  getActiveAcademicYear(): string | null {
    return this.activeAcademicYearSubject.value;
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.apiService.post<LoginResponse>('auth/login', credentials).pipe(
      tap(response => this.setSession(response))
    );
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.ACADEMIC_YEAR_KEY);
    this.currentUserSubject.next(null);
    this.activeAcademicYearSubject.next(null);
    this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    return !!token && !this.isTokenExpired(token);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  private setSession(authResult: LoginResponse): void {
    localStorage.setItem(this.TOKEN_KEY, authResult.token);
    this.setActiveAcademicYear(null);
    if (authResult.user) {
      // Normalize organizationId to string to handle int? from backend
      const user: AuthUser = {
        ...authResult.user,
        organizationId: authResult.user.organizationId != null ? String(authResult.user.organizationId) : null
      };
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      this.currentUserSubject.next(user);
    }
  }

  private getUserFromStorage(): AuthUser | null {
    const userStr = localStorage.getItem(this.USER_KEY);
    if (!userStr) return null;
    try {
      const user = JSON.parse(userStr) as AuthUser;
      if (user && user.organizationId != null) {
        user.organizationId = String(user.organizationId);
      }
      return user;
    } catch {
      return null;
    }
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp ? Date.now() >= payload.exp * 1000 : false;
    } catch {
      return false;
    }
  }
}
