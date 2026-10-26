import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Register } from './register';
import { AuthService } from '../../core/services/auth.service';
import { Router, provideRouter } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of, throwError } from 'rxjs';

describe('Register Component', () => {
  let component: Register;
  let fixture: ComponentFixture<Register>;
  let authServiceSpy: any;
  let snackBarSpy: any;
  let router: Router;
  let navigateSpy: any;

  beforeEach(async () => {
    authServiceSpy = {
      register: vi.fn().mockReturnValue(of({ message: 'Success' }))
    };
    snackBarSpy = {
      open: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [Register],
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
    navigateSpy = vi.spyOn(router, 'navigate').mockImplementation(() => Promise.resolve(true));

    fixture = TestBed.createComponent(Register);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create Register component', () => {
    expect(component).toBeTruthy();
  });

  it('should enable fields when enableFields() is invoked', () => {
    expect(component.fieldsEnabled).toBe(false);
    component.enableFields();
    expect(component.fieldsEnabled).toBe(true);
  });

  it('should detect when native and learning dialects are identical', () => {
    component.registerData.nativeDialect = '3ce6f6a4-af09-471a-bc08-0fd73db19936';
    component.registerData.learningDialect = '3ce6f6a4-af09-471a-bc08-0fd73db19936';
    expect(component.isDialectSame()).toBe(true);

    component.registerData.learningDialect = '9ad8d247-83a6-40b6-bfaf-babd9c6f3296';
    expect(component.isDialectSame()).toBe(false);
  });

  it('should not call register if native and learning dialects are the same', () => {
    component.registerData.nativeDialect = '3ce6f6a4-af09-471a-bc08-0fd73db19936';
    component.registerData.learningDialect = '3ce6f6a4-af09-471a-bc08-0fd73db19936';

    component.onSubmit();
    expect(authServiceSpy.register).not.toHaveBeenCalled();
  });

  it('should submit registration and navigate to verify-email on success', () => {
    component.registerData = {
      displayName: 'Test User',
      email: 'test@example.com',
      password: 'Password123!',
      nativeDialect: '3ce6f6a4-af09-471a-bc08-0fd73db19936',
      learningDialect: '9ad8d247-83a6-40b6-bfaf-babd9c6f3296'
    };

    component.onSubmit();

    expect(authServiceSpy.register).toHaveBeenCalledWith({
      displayName: 'Test User',
      email: 'test@example.com',
      password: 'Password123!',
      nativeDialectId: '3ce6f6a4-af09-471a-bc08-0fd73db19936',
      learningDialectId: '9ad8d247-83a6-40b6-bfaf-babd9c6f3296'
    });
    expect(navigateSpy).toHaveBeenCalledWith(['/verify-email'], {
      queryParams: { email: 'test@example.com' }
    });
  });

  it('should show snackbar message on registration failure', () => {
    authServiceSpy.register.mockReturnValue(throwError(() => ({
      status: 409,
      error: { message: 'Email in use' }
    })));

    component.registerData = {
      displayName: 'Test User',
      email: 'existing@example.com',
      password: 'Password123!',
      nativeDialect: '3ce6f6a4-af09-471a-bc08-0fd73db19936',
      learningDialect: '9ad8d247-83a6-40b6-bfaf-babd9c6f3296'
    };

    component.onSubmit();

    expect(snackBarSpy.open).toHaveBeenCalledWith(
      expect.stringContaining('هذا البريد الإلكتروني مستخدم بالفعل'),
      'حاول ثانية',
      expect.any(Object)
    );
    expect(component.isLoading()).toBe(false);
  });
});