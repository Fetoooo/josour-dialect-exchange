import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ExchangeService } from '../../core/services/exchange.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { UploadDialogComponent } from '../upload-dialog/upload-dialog.component';
import { MediaPlayerDialogComponent } from '../media-player-dialog/media-player-dialog.component';

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UserService } from '../../core/services/user.service';
import { AppSettingsService } from '../../core/services/app-settings.service';

@Component({
  selector: 'app-my-bridges',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink, RouterLinkActive, MatDialogModule, MatToolbarModule,
    MatButtonModule, MatIconModule, MatSidenavModule, MatCardModule,
    MatMenuModule, MatChipsModule, MatTabsModule, MatProgressBarModule
  ],
  templateUrl: './my-bridges.component.html',
  styleUrl: './my-bridges.component.scss'
})
export class MyBridgesComponent implements OnInit {
  public authService = inject(AuthService);
  public appSettings = inject(AppSettingsService);
  public exchangeService = inject(ExchangeService);
  private dialog = inject(MatDialog);
  private router = inject(Router);
  private userService = inject(UserService);
  private snackBar = inject(MatSnackBar);

  myExchanges = signal<any[]>([]);
  likedExchanges = signal<any[]>([]);
  allExchanges = signal<any[]>([]);
  savedExchanges = signal<any[]>([]);
  isLoading = signal(true);
  editingId = signal<string | null>(null);
  pendingDeleteId = signal<string | null>(null);
  editData = { title: '', description: '' };

  activeTab = signal<'my-clips' | 'liked-clips' | 'learning'>('my-clips');

  // User stats
  stats = signal({
    totalUploads: 0,
    totalLikes: 0,
    totalComments: 0,
    dialectsContributed: 0,
  });

  learningDialects = signal<any[]>([]);

  userReputation = computed(() => {
    const s = this.stats();
    const score = (s.totalUploads * 15) + (s.totalLikes * 5) + (s.totalComments * 2);
    let title = 'مستكشف لهجات';
    let badge = '🌱 عضو جديد';
    if (score >= 100) { title = 'سفير الثقافة العربية'; badge = '🏆 سفير معتمد'; }
    else if (score >= 50) { title = 'مساهم متميز'; badge = '🌟 مساهم ذهبي'; }
    else if (score >= 20) { title = 'مساهم نشط'; badge = '⚡ مساهم فضي'; }
    return { score, title, badge };
  });

  ngOnInit() {
    this.loadMyData();
  }

  loadMyData() {
    this.isLoading.set(true);
    this.userService.getMyProfile().subscribe({
      next: (profile) => {
        const selected = profile?.learningDialects ?? [];
        const total = profile?.exchangeCount ?? 0;
        if (selected.length > 0) {
          this.learningDialects.set(selected.map((dialect: any) => ({
            nameAr: dialect.name,
            flag: dialect.flag,
            progress: total ? Math.round((profile.exchanges.filter((ex: any) => ex.dialectId === dialect.id).length / total) * 100) : 0,
            level: 'مسار تعلم'
          })));
        } else {
          this.learningDialects.set([
            { nameAr: 'المصرية', flag: '🇪🇬', progress: 45, level: 'مبتدئ نشط' },
            { nameAr: 'الشامية', flag: '🇸🇾', progress: 25, level: 'مستكشف' },
            { nameAr: 'الخليجية', flag: '🇸🇦', progress: 15, level: 'بداية التعلم' }
          ]);
        }
      },
      error: () => {
        this.learningDialects.set([
          { nameAr: 'المصرية', flag: '🇪🇬', progress: 45, level: 'مبتدئ نشط' },
          { nameAr: 'الشامية', flag: '🇸🇾', progress: 25, level: 'مستكشف' },
          { nameAr: 'الخليجية', flag: '🇸🇦', progress: 15, level: 'بداية التعلم' }
        ]);
      }
    });

    this.exchangeService.getExchanges().subscribe({
      next: (data) => {
        this.allExchanges.set(data);
        const user = this.authService.currentUser();
        const mine = data.filter((ex: any) =>
          ex.user === user?.displayName || ex.userId === user?.id
        );
        this.myExchanges.set(mine);

        // Filter clips the user has liked / reacted to
        const liked = data.filter((ex: any) => this.exchangeService.isLiked(ex.id));
        this.likedExchanges.set(liked);

        this.stats.set({
          totalUploads: mine.length,
          totalLikes: mine.reduce((sum: number, ex: any) => sum + (ex.likes || 0), 0),
          totalComments: mine.reduce((sum: number, ex: any) => sum + (ex.commentCount || 0), 0),
          dialectsContributed: [...new Set(mine.map((ex: any) => ex.dialect))].length,
        });
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  onToggleLike(ex: any) {
    this.exchangeService.toggleLike(ex);
    // Refresh liked exchanges list
    const all = this.allExchanges();
    this.likedExchanges.set(all.filter((item: any) => this.exchangeService.isLiked(item.id)));
  }

  openPlayer(ex: any) {
    this.dialog.open(MediaPlayerDialogComponent, {
      data: { title: ex.title, mediaUrl: ex.mediaUrl, type: ex.type, dialect: ex.dialect, flag: ex.flag, user: ex.user },
      width: ex.type === 'video' ? '680px' : '420px',
      panelClass: 'media-dialog',
      backdropClass: 'dark-backdrop'
    });
  }

  openUploadDialog() {
    const ref = this.dialog.open(UploadDialogComponent, {
      width: '500px',
      panelClass: 'jusoor-glass-dialog'
    });
    ref.afterClosed().subscribe(result => {
      if (result) this.loadMyData();
    });
  }

  startEditing(exchange: any) {
    this.editingId.set(exchange.id);
    this.editData = { title: exchange.title, description: exchange.description ?? '' };
  }

  cancelEditing() { this.editingId.set(null); }

  saveEditing(id: string) {
    this.exchangeService.updateExchange(id, this.editData).subscribe({
      next: () => { this.editingId.set(null); this.loadMyData(); },
      error: () => this.snackBar.open('تعذر تعديل المقطع', 'إغلاق', { duration: 3000 })
    });
  }

  requestDelete(id: string) { this.pendingDeleteId.set(id); }
  cancelDelete() { this.pendingDeleteId.set(null); }

  deleteExchange(id: string) {
    this.exchangeService.deleteExchange(id).subscribe({
      next: () => { this.pendingDeleteId.set(null); this.loadMyData(); },
      error: () => this.snackBar.open('تعذر حذف المقطع', 'إغلاق', { duration: 3000 })
    });
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}