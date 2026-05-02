import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule
  ],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
  currentUser$ = this.authService.currentUser$;
  
  get currentUser() {
    return this.authService.getCurrentUser();
  }

  constructor(private authService: AuthService) {}

  getInitials(): string {
    const user = this.currentUser;
    if (user?.name) {
      return user.name.split(' ').map(n => n[0]).join('').toUpperCase();
    }
    return 'U';
  }

  logout(): void {
    this.authService.logout();
  }
}