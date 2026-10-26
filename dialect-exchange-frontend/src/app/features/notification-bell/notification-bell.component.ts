import { Component, inject, signal, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { NotificationService, AppNotification } from '../../core/services/notification.service';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.scss'
})
export class NotificationBellComponent {
  private notifService = inject(NotificationService);
  private router = inject(Router);
  private el = inject(ElementRef);

  isOpen = signal(false);

  notifications  = this.notifService.notifications;
  unreadCount    = this.notifService.unreadCount;
  hasUnread      = this.notifService.hasUnread;

  toggle() { this.isOpen.update(v => !v); }

  // Close when clicking outside
  @HostListener('document:click', ['$event'])
  onOutsideClick(e: MouseEvent) {
    if (!this.el.nativeElement.contains(e.target)) {
      this.isOpen.set(false);
    }
  }

  markAllRead() { this.notifService.markAllRead(); }
  clearAll()    { this.notifService.clearAll(); }

  onNotifClick(n: AppNotification) {
    this.notifService.markRead(n.id);
    this.isOpen.set(false);
    if (n.type === 'message' && n.targetId) {
      this.router.navigate(['/messages'], { queryParams: { user: n.targetId } });
    }
  }

  remove(e: MouseEvent, id: string) {
    e.stopPropagation();
    this.notifService.remove(id);
  }

  iconColor(type: AppNotification['type']): string {
    return { like: '#e53935', comment: '#ff6b35', message: '#0d9488', system: '#6366f1' }[type];
  }

  timeAgo(date: Date): string {
    const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (secs < 60)  return 'الآن';
    if (secs < 3600) return `منذ ${Math.floor(secs / 60)} دقيقة`;
    if (secs < 86400) return `منذ ${Math.floor(secs / 3600)} ساعة`;
    return `منذ ${Math.floor(secs / 86400)} يوم`;
  }
}