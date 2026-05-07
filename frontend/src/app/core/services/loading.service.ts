import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  private requestCount = 0;

  /**
   * Affiche le loader
   */
  show(): void {
    this.requestCount++;
    this.loadingSubject.next(true);
  }

  /**
   * Cache le loader
   */
  hide(): void {
    this.requestCount--;
    if (this.requestCount <= 0) {
      this.requestCount = 0;
      this.loadingSubject.next(false);
    }
  }

  /**
   * Force l'arrêt du loader
   */
  forceHide(): void {
    this.requestCount = 0;
    this.loadingSubject.next(false);
  }
}