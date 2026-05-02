import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { LoginRequest } from '../../../shared/models/auth.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  credentials: LoginRequest = {
    email: '',
    password: ''
  };
  loginError = '';

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.authService.validateSession().subscribe({
      next: payload => {
        if (payload?.redirectTo) {
          this.authService.navigateToLegacyTarget(payload.redirectTo);
        }
      },
      error: () => {}
    });
  }

  onSubmit(): void {
    this.loginError = '';
    this.authService.login({
      email: this.credentials.email.trim(),
      password: this.credentials.password
    }).subscribe({
      next: payload => this.authService.navigateToLegacyTarget(payload.redirectTo || '/user.html'),
      error: error => {
        this.loginError = error?.error?.error || error?.message || 'Connexion impossible';
      }
    });
  }
}
