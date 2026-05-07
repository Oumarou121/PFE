import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from '../services/loading.service';

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoadingService);

  // Afficher le loader
  loadingService.show();

  return next(req).pipe(
    finalize(() => {
      // Cacher le loader une fois la requête terminée
      loadingService.hide();
    })
  );
};