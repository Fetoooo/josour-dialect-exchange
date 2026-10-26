import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-mobile-nav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, MatIconModule],
  templateUrl: './mobile-nav.component.html',
  styleUrl: './mobile-nav.component.scss'
})
export class MobileNavComponent {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  get isVisible(): boolean {
    if (!this.authService.currentUser()) return false;
    const url = this.router.url.split('?')[0];
    const excludedRoutes = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];
    return !excludedRoutes.includes(url);
  }
}
