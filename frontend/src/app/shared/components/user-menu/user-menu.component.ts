import { CommonModule } from "@angular/common";
import { Component, HostListener } from "@angular/core";
import { Router } from "@angular/router";

import { AuthService } from "../../../core/services/auth.service";

@Component({
  selector: "app-user-menu",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="user-menu" [class.open]="open">
      <button class="user-menu__button" type="button" (click)="toggle($event)">
        <span class="user-menu__avatar">{{ initials }}</span>
        <span class="user-menu__name">{{ displayName }}</span>
        <i class="fa fa-angle-down"></i>
      </button>

      <div class="user-menu__dropdown" *ngIf="open">
        <button type="button" (click)="goToProfile()">
          <i class="fa fa-user"></i>
          Profil
        </button>
        <button type="button" class="danger" (click)="logout()">
          <i class="fa fa-sign-out"></i>
          Deconnexion
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .user-menu {
        position: relative;
        display: inline-flex;
        align-items: center;
        font-family: inherit;
      }
      .user-menu__button {
        min-height: 36px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border: 1px solid rgba(51, 122, 183, 0.26);
        border-radius: 8px;
        background: #fff;
        color: #445566;
        cursor: pointer;
        font: inherit;
        font-size: 0.78rem;
        font-weight: 700;
        padding: 5px 12px 5px 6px;
        transition: all 0.18s ease;
      }
      .user-menu__button:hover,
      .user-menu.open .user-menu__button {
        border-color: #337ab7;
        background: #f6f9fc;
        color: #275f91;
      }
      .user-menu__avatar {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: #e8f1f9;
        color: #337ab7;
        border: 1px solid #c2d9ee;
        font-size: 0.68rem;
        font-weight: 800;
      }
      .user-menu__name {
        max-width: 170px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .user-menu__dropdown {
        position: absolute;
        right: 0;
        top: calc(100% + 8px);
        min-width: 190px;
        z-index: 500;
        display: grid;
        gap: 4px;
        padding: 8px;
        border: 1px solid rgba(51, 122, 183, 0.18);
        border-radius: 12px;
        background: #fff;
        box-shadow: 0 16px 40px rgba(13, 27, 42, 0.13);
      }
      .user-menu__dropdown button {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        border: none;
        border-radius: 8px;
        background: transparent;
        color: #445566;
        cursor: pointer;
        font: inherit;
        font-size: 0.8rem;
        font-weight: 600;
        padding: 9px 10px;
        text-align: left;
      }
      .user-menu__dropdown button:hover {
        background: #e8f1f9;
        color: #275f91;
      }
      .user-menu__dropdown button.danger:hover {
        background: #fdf1f0;
        color: #c0392b;
      }
    `,
  ],
})
export class UserMenuComponent {
  open = false;

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  get displayName(): string {
    const user = this.auth.getCurrentUser();
    return user?.name || user?.email || "Compte";
  }

  get initials(): string {
    return this.displayName
      .split(/\s+/)
      .map((part) => part[0] || "")
      .join("")
      .substring(0, 2)
      .toUpperCase();
  }

  toggle(event: MouseEvent): void {
    event.stopPropagation();
    this.open = !this.open;
  }

  goToProfile(): void {
    this.open = false;
    this.router.navigate(["/profile"]);
  }

  logout(): void {
    this.open = false;
    this.auth.logout();
  }

  @HostListener("document:click")
  close(): void {
    this.open = false;
  }
}
