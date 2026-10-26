import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { ExchangeService } from '../../core/services/exchange.service';
import { DialectService } from '../../core/services/dialect.service';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatSelectModule } from '@angular/material/select';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatButtonModule, MatIconModule, MatCardModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatProgressSpinnerModule,
    MatDividerModule, MatSnackBarModule
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {
  public authService = inject(AuthService);
  public exchangeService = inject(ExchangeService);
  private userService = inject(UserService);
  private dialectService = inject(DialectService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  profile = signal<any>(null);
  isLoading = signal(true);
  isEditing = signal(false);
  isSaving = signal(false);
  isUploadingAvatar = signal(false);
  isUploadingCover = signal(false);

  activeTab = signal<'exchanges' | 'about' | 'dialects'>('exchanges');
  exchangeFilter = signal<'all' | 'video' | 'audio'>('all');

  editData = { displayName: '', bioAr: '', country: '', nativeDialectId: '', learningDialectIds: [] as string[] };
  
  get dialects() {
    return this.dialectService.dialects();
  }

  filteredExchanges = computed(() => {
    const list = this.profile()?.exchanges || [];
    const filter = this.exchangeFilter();
    if (filter === 'all') return list;
    return list.filter((ex: any) => ex.type === filter);
  });

  videoCount = computed(() => {
    return (this.profile()?.exchanges || []).filter((e: any) => e.type === 'video').length;
  });

  audioCount = computed(() => {
    return (this.profile()?.exchanges || []).filter((e: any) => e.type === 'audio').length;
  });

  ngOnInit() {
    this.loadProfile();
  }

  loadProfile() {
    this.isLoading.set(true);
    this.userService.getMyProfile().subscribe({
      next: (data) => {
        this.profile.set(data);
        this.editData = {
          displayName: data.displayName ?? '',
          bioAr: data.bioAr ?? '',
          country: data.country ?? '',
          nativeDialectId: data.nativeDialect?.id ?? this.dialects.find(d => d.name === data.nativeDialect?.name)?.id ?? '',
          learningDialectIds: (data.learningDialects ?? []).map((d: any) => d.id)
        };
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.snackBar.open('تعذّر تحميل الملف الشخصي', 'إغلاق', { duration: 3500 });
      }
    });
  }

  startEditing() {
    this.isEditing.set(true);
  }

  cancelEditing() {
    this.isEditing.set(false);
    const p = this.profile();
    if (!p) return;
    this.editData = {
      displayName: p.displayName ?? '',
      bioAr: p.bioAr ?? '',
      country: p.country ?? '',
      nativeDialectId: p.nativeDialect?.id ?? this.dialects.find(d => d.name === p.nativeDialect?.name)?.id ?? '',
      learningDialectIds: (p.learningDialects ?? []).map((d: any) => d.id)
    };
  }

  saveProfile() {
    this.isSaving.set(true);
    const payload = {
      displayName: this.editData.displayName?.trim() || '',
      bioAr: this.editData.bioAr ?? '',
      country: this.editData.country ?? '',
      nativeDialectId: this.editData.nativeDialectId?.trim() ? this.editData.nativeDialectId.trim() : null,
      learningDialectIds: (this.editData.learningDialectIds || []).filter(id => !!id && id.trim().length > 0)
    };

    this.userService.updateProfile(payload).subscribe({
      next: () => {
        const selectedNative = this.dialects.find(d => d.id === payload.nativeDialectId);
        this.profile.update(p => ({
          ...p,
          displayName: payload.displayName,
          bioAr: payload.bioAr,
          country: payload.country,
          nativeDialect: selectedNative ? { id: selectedNative.id, name: selectedNative.name, flag: selectedNative.flag } : (payload.nativeDialectId ? p?.nativeDialect : null),
          learningDialects: this.dialects.filter(d => payload.learningDialectIds.includes(d.id))
        }));

        // Update auth state displayName as well
        const curUser = this.authService.currentUser();
        if (curUser) {
          const updated = { ...curUser, displayName: payload.displayName };
          localStorage.setItem('user', JSON.stringify(updated));
          this.authService.currentUser.set(updated);
        }

        this.isSaving.set(false);
        this.isEditing.set(false);
        this.snackBar.open('تم حفظ التغييرات بنجاح!', 'تم', { duration: 3000 });
      },
      error: () => {
        this.isSaving.set(false);
        this.snackBar.open('حدث خطأ أثناء الحفظ', 'إغلاق', { duration: 3000 });
      }
    });
  }

  onProfileImageSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.isUploadingAvatar.set(true);
    this.userService.uploadProfileImage(file).subscribe({
      next: ({ profileImage }) => {
        this.profile.update(p => ({ ...p, profileImage }));
        const user = this.authService.currentUser();
        if (user) {
          const updated = { ...user, profileImage };
          localStorage.setItem('user', JSON.stringify(updated));
          this.authService.currentUser.set(updated);
        }
        this.isUploadingAvatar.set(false);
        this.snackBar.open('تم تحديث صورة الملف الشخصي بنجاح ✨', 'تم', { duration: 2500 });
      },
      error: () => {
        this.isUploadingAvatar.set(false);
        this.snackBar.open('تعذر رفع الصورة، يرجى المحاولة لاحقاً', 'إغلاق', { duration: 3000 });
      }
    });
  }

  deleteProfileImage() {
    this.isUploadingAvatar.set(true);
    this.userService.deleteProfileImage().subscribe({
      next: () => {
        this.profile.update(p => ({ ...p, profileImage: null }));
        const user = this.authService.currentUser();
        if (user) {
          const updated = { ...user, profileImage: null };
          localStorage.setItem('user', JSON.stringify(updated));
          this.authService.currentUser.set(updated);
        }
        this.isUploadingAvatar.set(false);
        this.snackBar.open('تم حذف صورة الملف الشخصي', 'تم', { duration: 2500 });
      },
      error: () => {
        this.isUploadingAvatar.set(false);
        this.snackBar.open('تعذر حذف الصورة', 'إغلاق', { duration: 3000 });
      }
    });
  }

  onCoverImageSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.isUploadingCover.set(true);
    this.userService.uploadCoverImage(file).subscribe({
      next: ({ coverImage }) => {
        this.profile.update(p => ({ ...p, coverImage }));
        this.isUploadingCover.set(false);
        this.snackBar.open('تم تحديث صورة الغلاف بنجاح 🎨', 'تم', { duration: 2500 });
      },
      error: () => {
        this.isUploadingCover.set(false);
        this.snackBar.open('تعذر رفع صورة الغلاف، حاول مرة أخرى', 'إغلاق', { duration: 3000 });
      }
    });
  }

  deleteCoverImage() {
    this.isUploadingCover.set(true);
    this.userService.deleteCoverImage().subscribe({
      next: () => {
        this.profile.update(p => ({ ...p, coverImage: null }));
        this.isUploadingCover.set(false);
        this.snackBar.open('تمت استعادة الغلاف الافتراضي', 'تم', { duration: 2500 });
      },
      error: () => {
        this.isUploadingCover.set(false);
        this.snackBar.open('تعذر إزالة صورة الغلاف', 'إغلاق', { duration: 3000 });
      }
    });
  }

  copyProfileLink() {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      this.snackBar.open('تم نسخ رابط ملفك الشخصي إلى الحافظة 📋', 'تم', { duration: 2500 });
    }
  }

  goBack() {
    this.router.navigate(['/home']);
  }
}