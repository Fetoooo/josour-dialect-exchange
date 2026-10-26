import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: '../auth-email-page.scss'
})
export class ForgotPasswordComponent {
  private authService = inject(AuthService);
  email = '';
  isLoading = signal(false);
  sent = signal(false);
  error = signal('');

  submit(): void {
    if (!this.email.trim()) return;
    this.isLoading.set(true);
    this.error.set('');
    this.authService.forgotPassword(this.email.trim()).pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: () => {
        this.sent.set(true);
      },
      error: () => {
        this.error.set('تعذر إرسال الرسالة حاليا. حاول مرة أخرى لاحقا.');
      }
    });
  }
}
