import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Interceptor multi-tenant :
 * - Injecte le JWT Bearer sur toutes les requêtes sauf POST /auth/login et POST /auth/register
 * - Permet d'accéder à GET /api/auth/profile et autres endpoints auth protégés
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  // Exclure uniquement les endpoints publics d'authentification
  const isPublicAuthEndpoint =
    req.url.includes('/auth/login') ||
    req.url.includes('/auth/register');

  if (token && !isPublicAuthEndpoint) {
    const authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });
    return next(authReq);
  }

  return next(req);
};
