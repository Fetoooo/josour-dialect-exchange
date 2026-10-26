import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable, tap } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ExchangeService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = environment.apiUrl + 'Exchanges';

  // ── Global Signal for User Liked Exchange IDs ───────────────
  likedIds = signal<Set<string>>(new Set<string>());

  constructor() {
    this.initLikes();
  }

  private getStorageKey(): string {
    const user = this.authService.currentUser();
    const userKey = user?.id || user?.email || 'guest';
    return `jusoor_liked_exchanges_${userKey}`;
  }

  public initLikes() {
    try {
      const key = this.getStorageKey();
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.likedIds.set(new Set(parsed));
          return;
        }
      }
      this.likedIds.set(new Set());
    } catch {
      this.likedIds.set(new Set());
    }
  }

  private persistLikes() {
    try {
      const key = this.getStorageKey();
      const ids = Array.from(this.likedIds());
      localStorage.setItem(key, JSON.stringify(ids));
    } catch {}
  }

  hasCustomThumbnail(ex: any): boolean {
    if (!ex || !ex.thumbnail) return false;
    const thumb = String(ex.thumbnail).trim();
    if (thumb === '') return false;
    if (thumb.includes('photo-1544717305-2782549b5136')) return false;
    return true;
  }

  isLiked(exchangeId: string): boolean {
    return this.likedIds().has(exchangeId);
  }

  toggleLike(ex: any): boolean {
    if (!ex || !ex.id) return false;
    const id = ex.id;
    const currentlyLiked = this.isLiked(id);
    const nextState = !currentlyLiked;

    // Optimistic UI update
    this.likedIds.update(set => {
      const next = new Set(set);
      if (nextState) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });

    if (nextState) {
      ex.likes = (ex.likes || 0) + 1;
    } else {
      ex.likes = Math.max(0, (ex.likes || 1) - 1);
    }
    ex.isLiked = nextState;
    this.persistLikes();

    // Call backend atomic toggle endpoint
    this.http.post<{ likes: number; isLiked: boolean }>(`${this.apiUrl}/${id}/like`, {}).subscribe({
      next: (res) => {
        if (res) {
          if (typeof res.likes === 'number') {
            ex.likes = res.likes;
          }
          if (typeof res.isLiked === 'boolean') {
            ex.isLiked = res.isLiked;
            this.likedIds.update(set => {
              const next = new Set(set);
              if (res.isLiked) {
                next.add(id);
              } else {
                next.delete(id);
              }
              return next;
            });
            this.persistLikes();
          }
        }
      },
      error: () => {
        // Rollback optimistic update on error
        this.likedIds.update(set => {
          const next = new Set(set);
          if (currentlyLiked) {
            next.add(id);
          } else {
            next.delete(id);
          }
          return next;
        });
        if (currentlyLiked) {
          ex.likes = (ex.likes || 0) + 1;
        } else {
          ex.likes = Math.max(0, (ex.likes || 1) - 1);
        }
        ex.isLiked = currentlyLiked;
        this.persistLikes();
      }
    });

    return nextState;
  }

  getExchanges(): Observable<any[]> {
    this.initLikes();
    return this.http.get<any[]>(this.apiUrl).pipe(
      tap(exchanges => {
        if (Array.isArray(exchanges)) {
          const current = new Set(this.likedIds());
          exchanges.forEach(ex => {
            if (ex.isLiked === true) {
              current.add(ex.id);
            } else if (ex.isLiked === false) {
              current.delete(ex.id);
            }
          });
          this.likedIds.set(current);
          this.persistLikes();
        }
      })
    );
  }

  uploadExchange(formData: FormData): Observable<any> {
    return this.http.post(this.apiUrl + '/upload', formData);
  }

  updateExchange(id: string, data: { title: string; description: string }): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, data);
  }

  deleteExchange(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  likeExchange(id: string): Observable<{ likes: number }> {
    return this.http.post<{ likes: number }>(`${this.apiUrl}/${id}/like`, {});
  }

  getComments(exchangeId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${exchangeId}/comments`);
  }

  addComment(exchangeId: string, content: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${exchangeId}/comments`, { content });
  }
}