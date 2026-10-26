import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ExchangeService } from '../../core/services/exchange.service';
import { ChatService } from '../../core/services/chat.service';
import { NotificationService } from '../../core/services/notification.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { UploadDialogComponent } from '../upload-dialog/upload-dialog.component';
import { MediaPlayerDialogComponent } from '../media-player-dialog/media-player-dialog.component';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';

import { AppSettingsService } from '../../core/services/app-settings.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports:[
    CommonModule, FormsModule, RouterLink, RouterLinkActive, MatDialogModule, MatToolbarModule,
    MatButtonModule, MatIconModule, MatSidenavModule, MatChipsModule,
    MatCardModule, MatMenuModule, MatInputModule, MatFormFieldModule,
    NotificationBellComponent
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  public  authService    = inject(AuthService);
  public  appSettings    = inject(AppSettingsService);
  public  exchangeService = inject(ExchangeService);
  private chatService    = inject(ChatService);
  private notifService   = inject(NotificationService);
  private dialog         = inject(MatDialog);
  private router         = inject(Router);

  allExchanges    = signal<any[]>([]);
  selectedDialect = signal<string>('الكل');
  searchQuery     = signal<string>('');
  commentsMap     = signal<Record<string, any[]>>({});
  openCommentId   = signal<string | null>(null);
  newCommentText  = signal<Record<string, string>>({});

  exchanges = computed(() => {
    const selected = this.selectedDialect();
    const query = this.searchQuery().trim().toLowerCase();
    let list = this.allExchanges();
    if (selected !== 'الكل') list = list.filter(ex => ex.dialect === selected);
    if (query) list = list.filter(ex =>
      ex.title?.toLowerCase().includes(query) ||
      ex.user?.toLowerCase().includes(query) ||
      ex.dialect?.toLowerCase().includes(query)
    );
    return list;
  });

  dialects = signal(['الكل', 'المصرية', 'الخليجية', 'الشامية', 'المغربية', 'الجزائرية', 'العراقية']);

  ngOnInit(): void {
    this.loadExchanges();
    this.startSignalR();
  }

  private startSignalR() {
    const token = this.authService.currentUser()?.token ?? localStorage.getItem('token') ?? '';
    if (token) {
      this.chatService.startConnection(token);
    }
  }

  loadExchanges() {
    this.exchangeService.getExchanges().subscribe({
      next: (data) => {
        this.allExchanges.set(data);
      },
      error: (err) => console.error('Error loading bridges:', err)
    });
  }

  selectDialect(dialect: string) { this.selectedDialect.set(dialect); }
  onSearch(value: string)        { this.searchQuery.set(value); }
  clearSearch()                  { this.searchQuery.set(''); }

  // ── Playback ──────────────────────────────────────────────
  openPlayer(ex: any) {
    this.dialog.open(MediaPlayerDialogComponent, {
      data: {
        title: ex.title,
        mediaUrl: ex.mediaUrl,
        type: ex.type,
        dialect: ex.dialect,
        flag: ex.flag,
        user: ex.user
      },
      width: ex.type === 'video' ? '680px' : '460px',
      panelClass: 'media-dialog',
      backdropClass: 'dark-backdrop'
    });
  }

  // ── Likes (Toggleable & Persistent) ────────────────────────
  onLike(ex: any) {
    this.exchangeService.toggleLike(ex);
  }

  // ── Comments ──────────────────────────────────────────────
  toggleComments(id: string) {
    if (this.openCommentId() === id) {
      this.openCommentId.set(null);
    } else {
      this.openCommentId.set(id);
      if (!this.commentsMap()[id]) {
        this.exchangeService.getComments(id).subscribe({
          next: (comments) => {
            this.commentsMap.update(map => ({ ...map, [id]: comments }));
          }
        });
      }
    }
  }

  getComments(id: string): any[]   { return this.commentsMap()[id] ??[]; }
  getNewComment(id: string): string { return this.newCommentText()[id] ?? ''; }
  setNewComment(id: string, value: string) {
    this.newCommentText.update(map => ({ ...map, [id]: value }));
  }

  submitComment(exchangeId: string) {
    const content = this.getNewComment(exchangeId).trim();
    if (!content) return;

    this.exchangeService.addComment(exchangeId, content).subscribe({
      next: (newComment) => {
        this.commentsMap.update(map => ({
          ...map, [exchangeId]: [newComment, ...(map[exchangeId] ??[])]
        }));
        this.allExchanges.update(list =>
          list.map(ex => ex.id === exchangeId
            ? { ...ex, commentCount: (ex.commentCount ?? 0) + 1 } : ex)
        );
        this.setNewComment(exchangeId, '');
      }
    });
  }

  // ── Auth ──────────────────────────────────────────────────
  logout() {
    this.chatService.stopConnection();
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  openUploadDialog() {
    this.dialog.open(UploadDialogComponent, {
      width: '500px', panelClass: 'jusoor-glass-dialog'
    }).afterClosed().subscribe(result => {
      if (result) {
        this.loadExchanges();
      }
    });
  }
}