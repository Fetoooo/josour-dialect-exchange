import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: '../auth-email-page.scss'
})
export class ResetPasswordComponent {
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  userId = this.route.snapshot.queryParamMap.get('userId') ?? '';
  token = this.route.snapshot.queryParamMap.get('token') ?? '';
  newPassword = '';
  confirmPassword = '';
  isLoading = signal(false);
  completed = signal(false);
  error = signal('');

  submit(): void {
    if (!this.userId || !this.token) {
      this.error.set('رابط إعادة التعيين غير صالح.');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.error.set('كلمتا المرور غير متطابقتين.');
      return;
    }

    this.isLoading.set(true);
    this.error.set('');
    this.authService.resetPassword({ userId: this.userId, token: this.token, newPassword: this.newPassword }).subscribe({
      next: () => {
        this.completed.set(true);
        this.isLoading.set(false);
        this.snackBar.open('تم تغيير كلمة المرور بنجاح! جاري توجيهك لتسجيل الدخول...', 'تم', { duration: 4000 });
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2500);
      },
      error: err => {
        this.error.set(err.error?.message || 'تعذر تغيير كلمة المرور. قد يكون الرابط منتهيا.');
        this.isLoading.set(false);
      }
    });
  }
}
