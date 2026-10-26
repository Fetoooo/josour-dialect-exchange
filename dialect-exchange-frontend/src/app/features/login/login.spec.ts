import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoginComponent } from './login.component';
import { AuthService } from '../../core/services/auth.service';
import { Router, provideRouter } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of, throwError } from 'rxjs';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authServiceSpy: any;
  let snackBarSpy: any;
  let router: Router;
  let navigateSpy: any;

  beforeEach(async () => {
    authServiceSpy = {
      login: vi.fn().mockReturnValue(of({ token: 'mock-jwt-token', displayName: 'Ali' }))
    };
    snackBarSpy = {
      open: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideAnimationsAsync(),
        { provide: AuthService, useValue: authServiceSpy },
        { provide: MatSnackBar, useValue: snackBarSpy }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    navigateSpy = vi.spyOn(router, 'navigateByUrl').mockImplementation(() => Promise.resolve(true));

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create LoginComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should enable fields on focus', () => {
    expect(component.fieldsEnabled).toBe(false);
    component.enableFields();
    expect(component.fieldsEnabled).toBe(true);
  });

  it('should call authService.login and navigate to /home on success', () => {
    component.loginData = { email: 'ali@example.com', password: 'Password123!' };
    component.onSubmit();

    expect(authServiceSpy.login).toHaveBeenCalledWith({
      email: 'ali@example.com',
      password: 'Password123!'
    });
    expect(navigateSpy).toHaveBeenCalledWith('/home');
    expect(snackBarSpy.open).toHaveBeenCalledWith(
      expect.stringContaining('تم تسجيل الدخول بنجاح'),
      'تم',
      expect.any(Object)
    );
  });

  it('should show email confirmation prompt when server returns 403', () => {
    authServiceSpy.login.mockReturnValue(throwError(() => ({ status: 403 })));

    component.loginData = { email: 'unconfirmed@example.com', password: 'Password123!' };
    component.onSubmit();

    expect(snackBarSpy.open).toHaveBeenCalledWith(
      'يرجى تأكيد بريدك الإلكتروني قبل تسجيل الدخول.',
      'إغلاق',
      expect.any(Object)
    );
    expect(component.isLoading()).toBe(false);
  });

  it('should show generic invalid credentials error for other statuses', () => {
    authServiceSpy.login.mockReturnValue(throwError(() => ({ status: 401 })));

    component.loginData = { email: 'wrong@example.com', password: 'bad' };
    component.onSubmit();

    expect(snackBarSpy.open).toHaveBeenCalledWith(
      'خطأ في البريد الإلكتروني أو كلمة المرور',
      'إغلاق',
      expect.any(Object)
    );
    expect(component.isLoading()).toBe(false);
  });
});
