import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { User, CreateUserRequest, UpdateUserRequest } from '../../../shared/models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly endpoint = 'users';

  constructor(private apiService: ApiService) {}

  /**
   * Récupère tous les utilisateurs
   */
  getUsers(): Observable<User[]> {
    return this.apiService.get<User[]>(this.endpoint);
  }

  /**
   * Récupère un utilisateur par son ID
   */
  getUserById(id: number): Observable<User> {
    return this.apiService.get<User>(`${this.endpoint}/${id}`);
  }

  /**
   * Crée un nouvel utilisateur
   */
  createUser(user: CreateUserRequest): Observable<User> {
    const userWithTimestamp = {
      ...user,
      createdAt: new Date().toISOString()
    };
    return this.apiService.post<User>(this.endpoint, userWithTimestamp);
  }

  /**
   * Met à jour un utilisateur
   */
  updateUser(user: UpdateUserRequest): Observable<User> {
    return this.apiService.put<User>(`${this.endpoint}/${user.id}`, user);
  }

  /**
   * Supprime un utilisateur
   */
  deleteUser(id: number): Observable<void> {
    return this.apiService.delete<void>(`${this.endpoint}/${id}`);
  }
}