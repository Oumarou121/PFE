import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { LoginRequest, LoginResponse, AuthUser } from '../../shared/models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'auth_user';
  
  private currentUserSubject = new BehaviorSubject<AuthUser | null>(this.getUserFromStorage());
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private apiService: ApiService,
    private router: Router
  ) {}

  /**
   * Connexion utilisateur
   */
  login(credentials: LoginRequest): Observable<LoginResponse> {
    // Simulation d'une authentification avec json-server
    return this.apiService.get<any>('auth').pipe(
      map(authData => {
        if (authData.email === credentials.email && authData.password === credentials.password) {
          const response: LoginResponse = {
            token: authData.token,
            user: {
              id: 1,
              email: authData.email,
              name: 'Admin User'
            }
          };
          return response;
        } else {
          throw new Error('Invalid credentials');
        }
      }),
      tap(response => {
        this.setSession(response);
      }),
      catchError(error => {
        return throwError(() => new Error('Email ou mot de passe incorrect'));
      })
    );
  }

  /**
   * Déconnexion utilisateur
   */
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  /**
   * Vérifie si l'utilisateur est connecté
   */
  isAuthenticated(): boolean {
    const token = this.getToken();
    return !!token && !this.isTokenExpired(token);
  }

  /**
   * Récupère le token d'authentification
   */
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Récupère l'utilisateur actuel
   */
  getCurrentUser(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  /**
   * Définit la session utilisateur
   */
  private setSession(authResult: LoginResponse): void {
    localStorage.setItem(this.TOKEN_KEY, authResult.token);
    if (authResult.user) {
      localStorage.setItem(this.USER_KEY, JSON.stringify(authResult.user));
      this.currentUserSubject.next(authResult.user);
    }
  }

  /**
   * Récupère l'utilisateur depuis le localStorage
   */
  private getUserFromStorage(): AuthUser | null {
    const userStr = localStorage.getItem(this.USER_KEY);
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Vérifie si le token est expiré (simulation)
   */
  private isTokenExpired(token: string): boolean {
    // Dans un vrai projet, vous devriez décoder le JWT et vérifier l'expiration
    // Ici, on simule que le token n'expire jamais pour la démo
    return false;
  }
}