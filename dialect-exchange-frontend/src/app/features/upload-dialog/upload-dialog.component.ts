import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ExchangeService } from '../../core/services/exchange.service';
import { DialectService } from '../../core/services/dialect.service';
import { AuthService } from '../../core/services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-upload-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatFormFieldModule, 
    MatInputModule, MatSelectModule, MatButtonModule, 
    MatButtonToggleModule, MatIconModule, MatProgressSpinnerModule
  ],
  templateUrl: './upload-dialog.component.html',
  styleUrl: './upload-dialog.component.scss'
})
export class UploadDialogComponent implements OnInit {
  private exchangeService = inject(ExchangeService);
  private dialectService = inject(DialectService);
  private authService = inject(AuthService);
  private dialogRef = inject(MatDialogRef<UploadDialogComponent>);
  private snackBar = inject(MatSnackBar);

  uploadData = { title: '', dialectId: '', mediaType: 'video', description: '' };
  selectedFile: File | null = null;
  selectedThumbnail: File | null = null;
  thumbnailPreview = '';
  isLoading = signal(false);

  get dialects() {
    return this.dialectService.dialects();
  }

  ngOnInit(): void {
    const user = this.authService.currentUser();
    const list = this.dialects;
    if (user?.nativeDialectId) {
      this.uploadData.dialectId = user.nativeDialectId;
    } else if (list.length > 0) {
      this.uploadData.dialectId = list[0].id;
    }
  }

  onFileSelected(event: any) {
    this.selectedFile = event.target.files[0];
  }

  onThumbnailSelected(event: any) {
    const file = event.target.files[0] as File | undefined;
    if (!file) return;
    this.selectedThumbnail = file;
    this.thumbnailPreview = URL.createObjectURL(file);
  }

  onUpload() {
    if (!this.uploadData.title?.trim()) {
      this.snackBar.open('يرجى إدخال عنوان للمقطع', 'تنبيه', { duration: 3500 });
      return;
    }

    if (!this.uploadData.dialectId) {
      this.snackBar.open('يرجى اختيار اللهجة الخاصة بالمقطع', 'تنبيه', { duration: 3500 });
      return;
    }

    if (!this.selectedFile) {
      this.snackBar.open('يرجى اختيار ملف الفيديو أو الصوت', 'تنبيه', { duration: 3500 });
      return;
    }

    this.isLoading.set(true);
    const formData = new FormData();
    formData.append('title', this.uploadData.title.trim());
    formData.append('dialectId', this.uploadData.dialectId);
    formData.append('mediaType', this.uploadData.mediaType);
    formData.append('file', this.selectedFile);
    if (this.uploadData.description?.trim()) {
      formData.append('description', this.uploadData.description.trim());
    }
    if (this.selectedThumbnail) {
      formData.append('thumbnailFile', this.selectedThumbnail);
    }

    this.exchangeService.uploadExchange(formData).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.snackBar.open('تم النشر بنجاح!', 'تم', { duration: 3500 });
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.isLoading.set(false);
        const errMsg = err.error?.message || 
          (err.error?.errors ? Object.values(err.error.errors).flat().join(' ') : null) || 
          'حدث خطأ أثناء الرفع، يرجى التأكد من البيانات والمحاولة مجدداً';
        this.snackBar.open(errMsg, 'إغلاق', { duration: 5000 });
      }
    });
  }
}