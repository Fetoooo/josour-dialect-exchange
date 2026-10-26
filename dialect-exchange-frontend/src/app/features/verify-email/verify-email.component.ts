import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './verify-email.component.html',
  styleUrl: '../auth-email-page.scss'
})
export class VerifyEmailComponent implements OnInit {
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);

  status = signal<'pending' | 'loading' | 'success' | 'error'>('loading');
  message = signal('جار التحقق من بريدك الإلكتروني...');

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const userId = params.get('userId');
    const token = params.get('token');

    if (!userId && !token) {
      this.status.set('pending');
      this.message.set('تم إنشاء حسابك بنجاح! افتح رسالة التحقق المرسلة إلى بريدك الإلكتروني لتفعيل الحساب.');
      return;
    }

    if (!userId || !token) {
      this.status.set('error');
      this.message.set('رابط التحقق غير صالح أو غير مكتمل.');
      return;
    }

    this.authService.confirmEmail({ userId, token }).subscribe({
      next: response => {
        this.status.set('success');
        this.message.set(response.message || 'تم تأكيد بريدك الإلكتروني بنجاح!');
      },
      error: err => {
        // If already confirmed or token handled
        const errText = err.error?.message || '';
        if (errText.includes('مفعل') || errText.includes('بالفعل') || errText.includes('already')) {
          this.status.set('success');
          this.message.set('بريدك الإلكتروني مفعل بالفعل! يمكنك تسجيل الدخول.');
        } else {
          this.status.set('error');
          this.message.set(errText || 'تعذر تأكيد البريد الإلكتروني. قد يكون الرابط منتهيا.');
        }
      }
    });
  }
}
