import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { inject } from '@angular/core';
import { AppSettingsService, AppSettings } from '../../core/services/app-settings.service';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatButtonModule, MatIconModule, MatSlideToggleModule, MatSnackBarModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
  private snackBar = inject(MatSnackBar);
  private appSettings = inject(AppSettingsService);
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private router = inject(Router);

  settings: AppSettings = { ...this.appSettings.settings() };
  deleteDialogOpen = false;
  isDeletingAccount = false;
  readonly supportEmail = 'josour.support@gmail.com';

  copySupportEmail(): void {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(this.supportEmail).then(() => {
        this.snackBar.open('تم نسخ بريد الدعم الفني: ' + this.supportEmail, 'تم', { duration: 2500, panelClass: ['success-snackbar'] });
      }).catch(() => {
        this.snackBar.open(this.supportEmail, 'إغلاق', { duration: 4000 });
      });
    } else {
      this.snackBar.open(this.supportEmail, 'إغلاق', { duration: 4000 });
    }
  }

  saveSettings(): void {
    this.appSettings.update(this.settings);
    this.snackBar.open('تم حفظ الإعدادات بنجاح', 'تم', { duration: 2500, panelClass: ['success-snackbar'] });
  }

  resetSettings(): void {
    this.appSettings.reset();
    this.settings = { ...this.appSettings.settings() };
    this.snackBar.open('تمت استعادة الإعدادات الافتراضية', 'تم', { duration: 2500 });
  }

  openDeleteDialog(): void {
    this.deleteDialogOpen = true;
  }

  closeDeleteDialog(): void {
    if (!this.isDeletingAccount) this.deleteDialogOpen = false;
  }

  confirmDeleteAccount(): void {
    this.isDeletingAccount = true;
    this.userService.deleteAccount().subscribe({
      next: () => {
        this.authService.logout();
        this.router.navigateByUrl('/login');
      },
      error: () => {
        this.isDeletingAccount = false;
        this.deleteDialogOpen = false;
        this.snackBar.open('تعذر حذف الحساب. حاول مرة أخرى.', 'تم', { duration: 3500, panelClass: ['error-snackbar'] });
      }
    });
  }
}
