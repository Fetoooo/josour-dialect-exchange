import { Component, inject, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { DialectService } from '../../core/services/dialect.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatFormFieldModule, MatInputModule, MatButtonModule, 
    MatIconModule, MatSelectModule, MatProgressSpinnerModule
  ],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register implements OnDestroy {
  registerData = { 
    displayName: '', 
    email: '', 
    password: '', 
    nativeDialect: '', 
    learningDialect: '' 
  };
  fieldsEnabled = false;
  
  isLoading = signal(false);
  private authService = inject(AuthService);
  private dialectService = inject(DialectService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  enableFields(): void {
    this.fieldsEnabled = true;
  }

  get dialects() {
    return this.dialectService.dialects();
  }

  isDialectSame(): boolean {
    return this.registerData.nativeDialect !== '' && 
           this.registerData.learningDialect !== '' && 
           this.registerData.nativeDialect === this.registerData.learningDialect;
  }

  onSubmit() {
    if (this.isDialectSame()) return;
    
    this.isLoading.set(true);
    const model = {
      displayName: this.registerData.displayName,
      email: this.registerData.email,
      password: this.registerData.password,
      nativeDialectId: this.registerData.nativeDialect,
      learningDialectId: this.registerData.learningDialect
    };

    this.authService.register(model).pipe(
      finalize(() => {
        this.isLoading.set(false);
      })
    ).subscribe({
      next: () => {
        this.resetForm();
        this.snackBar.open('تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتفعيله.', 'إغلاق', { 
          duration: 5000,
          panelClass: ['success-snackbar'] 
        });
        this.router.navigate(['/verify-email'], { queryParams: { email: model.email } });
      },
      error: (err) => {
        const message = err.name === 'TimeoutError'
          ? 'استغرق الخادم وقتاً طويلاً. تأكد من تشغيل قاعدة البيانات ثم حاول ثانية.'
          : err.status === 409
            ? 'هذا البريد الإلكتروني مستخدم بالفعل. جرّب تسجيل الدخول أو استخدم بريدا آخر.'
            : err.error?.message || 'تعذر إنشاء الحساب، يرجى التأكد من البيانات';
        this.snackBar.open(message, 'حاول ثانية', { 
          duration: 5000 
        });
      }
    });
  }

  private resetForm(): void {
    this.registerData = {
      displayName: '', email: '', password: '', nativeDialect: '', learningDialect: ''
    };
    this.fieldsEnabled = false;
  }

  ngOnDestroy(): void {
    this.resetForm();
    this.isLoading.set(false);
  }
}