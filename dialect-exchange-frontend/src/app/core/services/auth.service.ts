import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { environment } from '../../../environments/environment';
import { map, timeout } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private apiUrl = environment.apiUrl;

  currentUser = signal<any>(null);
  private expirationTimer: any = null;

  constructor() {
    this.initializeSession();
    this.listenForSessionActivity();
  }

  /**
   * Initializes session from localStorage and checks for expiration.
   */
  private initializeSession(): void {
    const savedUserStr = localStorage.getItem('user');
    if (!savedUserStr) return;

    try {
      const savedUser = JSON.parse(savedUserStr);
      const token = savedUser?.token || savedUser?.Token;

      if (!token || this.isTokenExpired(token)) {
        this.logout('انتهت صلاحية جلستك، يرجى تسجيل الدخول مجدداً.');
        return;
      }

      this.currentUser.set(savedUser);
      this.scheduleTokenExpirationTimer(token);
    } catch {
      this.logout();
    }
  }

  /**
   * Periodically and upon window focus/tab change validates whether token has expired.
   */
  private listenForSessionActivity(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('focus', () => {
      this.validateCurrentSession();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.validateCurrentSession();
      }
    });
  }

  /**
   * Checks whether the current session is still valid.
   */
  validateCurrentSession(): boolean {
    const user = this.currentUser();
    if (!user) return false;

    const token = user?.token || user?.Token;
    if (!token || this.isTokenExpired(token)) {
      this.logout('انتهت صلاحية جلستك، يرجى تسجيل الدخول مجدداً.');
      return false;
    }
    return true;
  }

  /**
   * Decodes JWT and determines if it has expired.
   */
  isTokenExpired(token?: string): boolean {
    if (!token || typeof token !== 'string') return true;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return true;

      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const payload = JSON.parse(jsonPayload);
      if (!payload.exp) return false;

      const nowInSeconds = Math.floor(Date.now() / 1000);
      return payload.exp <= nowInSeconds;
    } catch {
      return true;
    }
  }

  /**
   * Schedules an automatic logout when the JWT token expiration time is reached.
   */
  private scheduleTokenExpirationTimer(token: string): void {
    if (this.expirationTimer) {
      clearTimeout(this.expirationTimer);
      this.expirationTimer = null;
    }

    try {
      const parts = token.split('.');
      if (parts.length !== 3) return;
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64));
      if (!payload.exp) return;

      const remainingMs = (payload.exp * 1000) - Date.now();
      if (remainingMs <= 0) {
        this.logout('انتهت صلاحية جلستك، يرجى تسجيل الدخول مجدداً.');
        return;
      }

      this.expirationTimer = setTimeout(() => {
        this.logout('انتهت صلاحية جلستك، يرجى تسجيل الدخول مجدداً.');
      }, remainingMs);
    } catch {
      // Ignore parsing errors
    }
  }

  isAuthenticated(): boolean {
    return this.validateCurrentSession();
  }

  login(model: any) {
    return this.http.post<any>(this.apiUrl + 'auth/login', model).pipe(
      map(user => {
        if (user) {
          localStorage.setItem('user', JSON.stringify(user));
          this.currentUser.set(user);
          const token = user.token || user.Token;
          if (token) {
            this.scheduleTokenExpirationTimer(token);
          }
        }
        return user;
      })
    );
  }

  register(model: any) {
    // This sends the data to your .NET AuthController [HttpPost("register")]
    return this.http.post(this.apiUrl + 'auth/register', model).pipe(
      timeout(15000)
    );
  }

  confirmEmail(model: { userId: string; token: string }) {
    return this.http.post<{ message: string }>(this.apiUrl + 'auth/confirm-email', model).pipe(timeout(15000));
  }

  forgotPassword(email: string) {
    return this.http.post<{ message: string }>(this.apiUrl + 'auth/forgot-password', { email }).pipe(timeout(15000));
  }

  resetPassword(model: { userId: string; token: string; newPassword: string }) {
    return this.http.post<{ message: string }>(this.apiUrl + 'auth/reset-password', model).pipe(timeout(15000));
  }

  logout(message?: string) {
    if (this.expirationTimer) {
      clearTimeout(this.expirationTimer);
      this.expirationTimer = null;
    }

    localStorage.removeItem('user');
    localStorage.removeItem('token');
    this.currentUser.set(null);

    if (message) {
      this.snackBar.open(message, 'تم', {
        duration: 3500,
        panelClass: ['warning-snackbar']
      });
    }

    const publicRoutes = ['/login', '/register', '/landing', '/verify-email', '/forgot-password', '/reset-password'];
    const currentPath = (this.router.url || '').split('?')[0];
    if (!publicRoutes.includes(currentPath)) {
      this.router.navigate(['/login']);
    }
  }
}