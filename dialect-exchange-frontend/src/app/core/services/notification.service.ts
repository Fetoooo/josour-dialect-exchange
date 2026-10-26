import { inject, Injectable, signal, computed } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AppSettingsService } from './app-settings.service';

export interface AppNotification {
  id: string;
  type: 'like' | 'comment' | 'message' | 'system';
  title: string;
  body: string;
  icon: string;        // material icon name
  fromUser?: string;
  targetId?: string;   // exchangeId or conversationId
  isRead: boolean;
  createdAt: Date;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private snackBar = inject(MatSnackBar);
  private appSettings = inject(AppSettingsService);

  // ── In-app notification store ────────────────────────
  private _notifications = signal<AppNotification[]>([]);

  notifications   = this._notifications.asReadonly();
  unreadCount     = computed(() => this._notifications().filter(n => !n.isRead).length);
  hasUnread       = computed(() => this.unreadCount() > 0);

  // ── Push a new notification ──────────────────────────
  push(notif: Omit<AppNotification, 'id' | 'isRead' | 'createdAt'>) {
    if (notif.type === 'message' && !this.appSettings.settings().messageNotifications) return;
    const full: AppNotification = {
      ...notif,
      id: crypto.randomUUID(),
      isRead: false,
      createdAt: new Date()
    };
    // Prepend, keep max 50
    this._notifications.update(list => [full, ...list].slice(0, 50));
    // Also show a brief snackbar
    this.snackBar.open(notif.body, '✕', {
      duration: 4000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
      panelClass: ['jusoor-snackbar', `snackbar-${notif.type}`]
    });
    if (this.appSettings.settings().soundEffects) this.playNotificationSound();
  }

  private playNotificationSound(): void {
    try {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 740;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.16);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.17);
    } catch { /* Audio can be unavailable until a user gesture. */ }
  }

  // ── Convenience helpers ──────────────────────────────
  notifyLike(fromUser: string, exchangeTitle: string, exchangeId: string) {
    this.push({
      type: 'like',
      title: 'إعجاب جديد',
      body: `أعجب ${fromUser} بمقطعك "${exchangeTitle}"`,
      icon: 'favorite',
      fromUser,
      targetId: exchangeId
    });
  }

  notifyComment(fromUser: string, exchangeTitle: string, exchangeId: string, preview: string) {
    this.push({
      type: 'comment',
      title: 'تعليق جديد',
      body: `علّق ${fromUser} على "${exchangeTitle}": ${preview.slice(0, 40)}`,
      icon: 'chat_bubble',
      fromUser,
      targetId: exchangeId
    });
  }

  notifyMessage(fromUser: string, preview: string, userId: string) {
    this.push({
      type: 'message',
      title: 'رسالة جديدة',
      body: `${fromUser}: ${preview.slice(0, 50)}`,
      icon: 'chat',
      fromUser,
      targetId: userId
    });
  }

  notifySystem(title: string, body: string) {
    this.push({ type: 'system', title, body, icon: 'info' });
  }

  // ── Read management ──────────────────────────────────
  markRead(id: string) {
    this._notifications.update(list =>
      list.map(n => n.id === id ? { ...n, isRead: true } : n)
    );
  }

  markAllRead() {
    this._notifications.update(list => list.map(n => ({ ...n, isRead: true })));
  }

  remove(id: string) {
    this._notifications.update(list => list.filter(n => n.id !== id));
  }

  clearAll() { this._notifications.set([]); }

  // ── Legacy snackbar helpers (keep existing callers working) ─
  showSuccess(message: string) {
    this.snackBar.open(message, 'تم', {
      duration: 5000, horizontalPosition: 'center', verticalPosition: 'bottom',
      panelClass: ['success-snackbar']
    });
  }

  showError(message: string) {
    this.snackBar.open(message, 'إغلاق', {
      duration: 7000, horizontalPosition: 'center', verticalPosition: 'bottom',
      panelClass: ['error-snackbar']
    });
  }
}