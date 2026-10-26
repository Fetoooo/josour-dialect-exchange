import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

describe('AuthService', () => {
  let service: AuthService;
  let httpTesting: HttpTestingController;
  let routerSpy: any;
  let snackBarSpy: any;

  function createMockToken(expInSeconds: number): string {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
      email: 'test@example.com',
      sub: 'user-123',
      exp: expInSeconds
    }));
    return `${header}.${payload}.signature`;
  }

  beforeEach(() => {
    localStorage.clear();
    routerSpy = {
      navigate: vi.fn(),
      url: '/home'
    };
    snackBarSpy = {
      open: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerSpy },
        { provide: MatSnackBar, useValue: snackBarSpy }
      ]
    });

    service = TestBed.inject(AuthService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Token Expiration & Validation', () => {
    it('should identify an expired token correctly', () => {
      const pastExp = Math.floor(Date.now() / 1000) - 3600;
      const expiredToken = createMockToken(pastExp);
      expect(service.isTokenExpired(expiredToken)).toBe(true);
    });

    it('should identify a valid future token correctly', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      const validToken = createMockToken(futureExp);
      expect(service.isTokenExpired(validToken)).toBe(false);
    });

    it('should handle malformed tokens gracefully', () => {
      expect(service.isTokenExpired('')).toBe(true);
      expect(service.isTokenExpired('invalid.token')).toBe(true);
      expect(service.isTokenExpired(undefined)).toBe(true);
    });
  });

  describe('Login & Logout', () => {
    it('should send login POST request and store user session upon success', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      const mockToken = createMockToken(futureExp);
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test',
        token: mockToken
      };

      service.login({ email: 'test@example.com', password: 'Password123!' }).subscribe(user => {
        expect(user).toEqual(mockUser);
        expect(service.currentUser()).toEqual(mockUser);
        expect(localStorage.getItem('user')).toContain('user-123');
      });

      const req = httpTesting.expectOne(`${environment.apiUrl}auth/login`);
      expect(req.request.method).toBe('POST');
      req.flush(mockUser);
    });

    it('should clear stored session and redirect on logout', () => {
      localStorage.setItem('user', JSON.stringify({ token: 'abc' }));
      service.currentUser.set({ token: 'abc' });

      service.logout('Logged out message');

      expect(localStorage.getItem('user')).toBeNull();
      expect(service.currentUser()).toBeNull();
      expect(snackBarSpy.open).toHaveBeenCalledWith('Logged out message', 'تم', expect.any(Object));
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
    });
  });

  describe('Session State', () => {
    it('should report unauthenticated when no user is logged in', () => {
      service.currentUser.set(null);
      expect(service.isAuthenticated()).toBe(false);
    });

    it('should report authenticated when user holds a valid token', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      const validToken = createMockToken(futureExp);
      service.currentUser.set({ token: validToken });
      expect(service.isAuthenticated()).toBe(true);
    });
  });
});
