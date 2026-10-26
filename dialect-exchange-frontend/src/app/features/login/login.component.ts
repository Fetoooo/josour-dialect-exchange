import { Component, inject, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports:[
    CommonModule, FormsModule, RouterLink,
    MatCardModule, MatFormFieldModule, MatInputModule, 
    MatButtonModule, MatIconModule, MatProgressSpinnerModule
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnDestroy {
  loginData = { email: '', password: '' };
  fieldsEnabled = false;
  isLoading = signal(false); // <-- FIXED: Now using a Signal
  
  private authService = inject(AuthService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  enableFields(): void {
    this.fieldsEnabled = true;
  }

  onSubmit() {
    this.isLoading.set(true); // <-- FIXED
    
    this.authService.login(this.loginData).pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: () => {
        this.loginData = { email: '', password: '' };
        this.snackBar.open('تم تسجيل الدخول بنجاح. أهلاً بك مجدداً!', 'تم', { 
          duration: 3000,
          panelClass: ['success-snackbar']
        });
        this.router.navigateByUrl('/home');
      },
      error: (err: any) => {
        const message = err.status === 403
          ? 'يرجى تأكيد بريدك الإلكتروني قبل تسجيل الدخول.'
          : 'خطأ في البريد الإلكتروني أو كلمة المرور';
        this.snackBar.open(message, 'إغلاق', { 
          duration: 5000 
        });
        this.loginData = { email: '', password: '' };
      }
    });
  }

  ngOnDestroy(): void {
    this.loginData = { email: '', password: '' };
    this.fieldsEnabled = false;
    this.isLoading.set(false);
  }
}