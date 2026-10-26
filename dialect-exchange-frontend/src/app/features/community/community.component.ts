import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AppSettingsService } from '../../core/services/app-settings.service';

@Component({
  selector: 'app-community',
  standalone: true,
  imports: [
    CommonModule, RouterLink, RouterLinkActive, MatDialogModule, MatToolbarModule,
    MatButtonModule, MatIconModule, MatSidenavModule, MatCardModule,
    MatMenuModule, MatChipsModule, MatProgressBarModule
  ],
  templateUrl: './community.component.html',
  styleUrl: './community.component.scss'
})
export class CommunityComponent implements OnInit {
  public authService = inject(AuthService);
  public appSettings = inject(AppSettingsService);
  public exchangeService = inject(ExchangeService);
  private dialog = inject(MatDialog);
  private router = inject(Router);

  topContributors = signal<any[]>([]);
  recentExchanges = signal<any[]>([]);
  isLoading = signal(true);

  communityStats = signal({
    totalMembers: 0,
    totalExchanges: 0,
    totalDialects: 0,
    activeToday: 0,
  });
  leaderboard = signal<any[]>([]);
  dialectStats = signal<any[]>([]);

  podium = computed(() => this.leaderboard().slice(0, 3));
  remainingLeaders = computed(() => this.leaderboard().slice(3));

  ngOnInit() {
    this.exchangeService.getExchanges().subscribe({
      next: (data) => {
        this.recentExchanges.set(data.slice(0, 10));
        const users = new Map<string, any>();
        const dialects = new Map<string, any>();
        data.forEach((exchange: any) => {
          if (exchange.userId) {
            const member = users.get(exchange.userId) ?? {
              userId: exchange.userId, name: exchange.user, dialect: exchange.dialect,
              flag: exchange.flag, profileImage: exchange.profileImage, uploads: 0, likes: 0
            };
            member.uploads += 1;
            member.likes += exchange.likes ?? 0;
            users.set(exchange.userId, member);
          }
          const dialect = dialects.get(exchange.dialect) ?? { name: exchange.dialect, flag: exchange.flag, count: 0 };
          dialect.count += 1;
          dialects.set(exchange.dialect, dialect);
        });
        const ranked = [...users.values()].sort((a, b) => b.likes - a.likes || b.uploads - a.uploads);
        this.leaderboard.set(ranked.slice(0, 5).map((member, index) => ({
          ...member, rank: index + 1, badge: ['🥇', '🥈', '🥉'][index] ?? ''
        })));
        const totalExchanges = data.length;
        this.dialectStats.set([...dialects.values()]
          .sort((a, b) => b.count - a.count)
          .map(dialect => ({ ...dialect, percent: totalExchanges ? Math.round((dialect.count / totalExchanges) * 100) : 0 })));
        const today = new Date().toDateString();
        this.communityStats.update(s => ({
          ...s,
          totalExchanges: data.length,
          totalMembers: users.size,
          totalDialects: dialects.size,
          activeToday: new Set(data.filter((exchange: any) => exchange.createdAt && new Date(exchange.createdAt).toDateString() === today).map((exchange: any) => exchange.userId)).size,
        }));
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  openPlayer(ex: any) {
    this.dialog.open(MediaPlayerDialogComponent, {
      data: { title: ex.title, mediaUrl: ex.mediaUrl, type: ex.type, dialect: ex.dialect, flag: ex.flag, user: ex.user },
      width: ex.type === 'video' ? '680px' : '420px',
      panelClass: 'media-dialog',
      backdropClass: 'dark-backdrop'
    });
  }

  onToggleLike(ex: any, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.exchangeService.toggleLike(ex);
  }

  openUploadDialog() {
    const ref = this.dialog.open(UploadDialogComponent, {
      width: '500px',
      panelClass: 'jusoor-glass-dialog'
    });
    ref.afterClosed().subscribe(result => {
      if (result) this.ngOnInit();
    });
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}