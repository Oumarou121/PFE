import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { UserService } from '../services/user.service';
import { NotificationService } from '../../../core/services/notification.service';
import { User } from '../../../shared/models/user.model';

@Component({
  selector: 'app-users-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './users-form.component.html',
  styleUrls: ['./users-form.component.scss']
})
export class UsersFormComponent implements OnInit {
  userForm!: FormGroup;
  isEditMode = false;
  isLoading = false;
  userId?: number;

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private router: Router,
    private route: ActivatedRoute,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.checkEditMode();
  }

  private initForm(): void {
    this.userForm = this.fb.group({
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      role: ['User', [Validators.required]],
      status: ['Active', [Validators.required]]
    });
  }

  private checkEditMode(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode = true;
      this.userId = +id;
      this.loadUser(this.userId);
    }
  }

  private loadUser(id: number): void {
    this.userService.getUserById(id).subscribe({
      next: (user) => {
        this.userForm.patchValue({
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          status: user.status
        });
      },
      error: (error) => {
        console.error('Erreur lors du chargement de l\'utilisateur:', error);
        this.notificationService.showError('Utilisateur non trouvé');
        this.goBack();
      }
    });
  }

  onSubmit(): void {
    if (this.userForm.valid) {
      this.isLoading = true;
      const formData = this.userForm.value;

      const operation = this.isEditMode 
        ? this.userService.updateUser({ ...formData, id: this.userId })
        : this.userService.createUser(formData);

      operation.subscribe({
        next: (user) => {
          const message = this.isEditMode 
            ? 'Utilisateur modifié avec succès' 
            : 'Utilisateur créé avec succès';
          
          this.notificationService.showSuccess(message);
          this.router.navigate(['/users']);
        },
        error: (error) => {
          console.error('Erreur lors de l\'enregistrement:', error);
          this.isLoading = false;
        },
        complete: () => {
          this.isLoading = false;
        }
      });
    }
  }

  goBack(): void {
    this.router.navigate(['/users']);
  }
}