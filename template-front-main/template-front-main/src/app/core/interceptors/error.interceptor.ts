import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';
import { AuthService } from '../services/auth.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notificationService = inject(NotificationService);
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError(error => {
      let errorMessage = 'Une erreur est survenue';

      if (error.error instanceof ErrorEvent) {
        // Erreur côté client
        errorMessage = `Erreur: ${error.error.message}`;
      } else {
        // Erreur côté serveur
        switch (error.status) {
          case 401:
            errorMessage = 'Non autorisé. Veuillez vous reconnecter.';
            authService.logout();
            break;
          case 403:
            errorMessage = 'Accès interdit.';
            break;
          case 404:
            errorMessage = 'Ressource non trouvée.';
            break;
          case 500:
            errorMessage = 'Erreur serveur interne.';
            break;
          default:
            errorMessage = error.error?.message || `Erreur ${error.status}: ${error.statusText}`;
        }
      }

      // Afficher la notification d'erreur
      notificationService.showError(errorMessage);

      return throwError(() => error);
    })
  );
};