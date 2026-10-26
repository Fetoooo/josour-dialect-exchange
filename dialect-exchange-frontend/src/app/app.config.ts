import { ApplicationConfig, importProvidersFrom, inject } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient, withInterceptors, HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './core/services/auth.service';

import { routes } from './app.routes';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  const savedUser = localStorage.getItem('user');
  let token: string | null = null;

  if (savedUser) {
    try {
      const parsedUser = JSON.parse(savedUser);
      // Ensure we check for both lowercase 'token' and uppercase 'Token'
      token = parsedUser.token || parsedUser.Token;
    } catch (e) {
      // Fallback in case the token was saved as a raw string instead of JSON
      token = savedUser;
    }
  }

  // If token is already expired, log out immediately
  if (token && authService.isTokenExpired(token)) {
    authService.logout('انتهت صلاحية جلستك، يرجى تسجيل الدخول مجدداً.');
    return throwError(() => new Error('Session expired'));
  }

  let requestToSend = req;
  if (token) {
    requestToSend = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(requestToSend).pipe(
    catchError((error: any) => {
      // 401 Unauthorized from backend (expired/invalid token)
      if (error instanceof HttpErrorResponse && error.status === 401) {
        authService.logout('انتهت صلاحية جلستك، يرجى تسجيل الدخول مجدداً.');
      }
      return throwError(() => error);
    })
  );
};

export const appConfig: ApplicationConfig = {
  providers:[
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
    importProvidersFrom(MatSnackBarModule)
  ]
};