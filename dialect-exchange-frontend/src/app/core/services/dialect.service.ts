import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap, catchError, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DialectItem {
  id: string;
  nameAr: string;
  nameEn?: string;
  country?: string;
  region?: string;
  flagEmoji?: string;
  emoji?: string;
  description?: string;
  name?: string; // For compatibility with components expecting .name
  flag?: string; // For compatibility with components expecting .flag
}

export const FALLBACK_DIALECTS: DialectItem[] = [
  { id: '3ce6f6a4-af09-471a-bc08-0fd73db19936', nameAr: 'المصرية', nameEn: 'Egyptian', country: 'مصر', region: 'شمال أفريقيا', flagEmoji: '🇪🇬', emoji: '🇪🇬', name: 'المصرية', flag: '🇪🇬' },
  { id: '9ad8d247-83a6-40b6-bfaf-babd9c6f3296', nameAr: 'الخليجية', nameEn: 'Gulf', country: 'السعودية', region: 'الخليج العربي', flagEmoji: '🇸🇦', emoji: '🇸🇦', name: 'الخليجية', flag: '🇸🇦' },
  { id: '8d00c7c9-ac3b-470d-9e10-049b4cc763bc', nameAr: 'الشامية', nameEn: 'Levantine', country: 'سوريا/لبنان', region: 'بلاد الشام', flagEmoji: '🇸🇾', emoji: '🇸🇾', name: 'الشامية', flag: '🇸🇾' },
  { id: '87c7a144-f198-4dce-85ec-6c28bc8fbd8d', nameAr: 'العراقية', nameEn: 'Iraqi', country: 'العراق', region: 'العراق', flagEmoji: '🇮🇶', emoji: '🇮🇶', name: 'العراقية', flag: '🇮🇶' },
  { id: 'af801238-f7fb-41c4-80e4-7dd1a5a20ac6', nameAr: 'المغربية', nameEn: 'Moroccan', country: 'المغرب', region: 'المغرب العربي', flagEmoji: '🇲🇦', emoji: '🇲🇦', name: 'المغربية', flag: '🇲🇦' },
  { id: '4fbd3ed8-8420-4b29-b8e7-fc9af645b335', nameAr: 'التونسية', nameEn: 'Tunisian', country: 'تونس', region: 'المغرب العربي', flagEmoji: '🇹🇳', emoji: '🇹🇳', name: 'التونسية', flag: '🇹🇳' },
  { id: 'c16e3835-2f84-40b0-8984-87347e14c56d', nameAr: 'الجزائرية', nameEn: 'Algerian', country: 'الجزائر', region: 'المغرب العربي', flagEmoji: '🇩🇿', emoji: '🇩🇿', name: 'الجزائرية', flag: '🇩🇿' },
  { id: '9771371e-df21-4787-9a3e-2997d3cd909d', nameAr: 'الليبية', nameEn: 'Libyan', country: 'ليبيا', region: 'شمال أفريقيا', flagEmoji: '🇱🇾', emoji: '🇱🇾', name: 'الليبية', flag: '🇱🇾' },
  { id: '25e05995-5e53-4069-9369-b431d6e8a686', nameAr: 'اليمنية', nameEn: 'Yemeni', country: 'اليمن', region: 'شبه الجزيرة', flagEmoji: '🇾🇪', emoji: '🇾🇪', name: 'اليمنية', flag: '🇾🇪' },
  { id: '57fd823c-297c-44dc-a6b0-b9196c91570c', nameAr: 'الأردنية', nameEn: 'Jordanian', country: 'الأردن', region: 'بلاد الشام', flagEmoji: '🇯🇴', emoji: '🇯🇴', name: 'الأردنية', flag: '🇯🇴' },
  { id: '53f49bc2-60bd-425b-98eb-11676238c667', nameAr: 'الفلسطينية', nameEn: 'Palestinian', country: 'فلسطين', region: 'بلاد الشام', flagEmoji: '🇵🇸', emoji: '🇵🇸', name: 'الفلسطينية', flag: '🇵🇸' },
  { id: 'b2540480-bbab-41ca-9ad1-b345bee434e4', nameAr: 'السودانية', nameEn: 'Sudanese', country: 'السودان', region: 'شمال أفريقيا', flagEmoji: '🇸🇩', emoji: '🇸🇩', name: 'السودانية', flag: '🇸🇩' }
];

@Injectable({
  providedIn: 'root'
})
export class DialectService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl.endsWith('/') ? environment.apiUrl : `${environment.apiUrl}/`;

  readonly dialects = signal<DialectItem[]>(FALLBACK_DIALECTS);

  constructor() {
    this.loadDialects().subscribe();
  }

  loadDialects(): Observable<DialectItem[]> {
    return this.http.get<any[]>(`${this.baseUrl}dialects`).pipe(
      map(items => {
        if (!items || !items.length) return FALLBACK_DIALECTS;
        return items.map(d => ({
          id: d.id,
          nameAr: d.nameAr,
          nameEn: d.nameEn,
          country: d.country,
          region: d.region,
          flagEmoji: d.flagEmoji || '🌍',
          emoji: d.flagEmoji || '🌍',
          name: d.nameAr,
          flag: d.flagEmoji || '🌍',
          description: d.description
        }));
      }),
      tap(loaded => {
        if (loaded && loaded.length) {
          this.dialects.set(loaded);
        }
      }),
      catchError(() => of(this.dialects()))
    );
  }

  getDialectById(id: string): DialectItem | undefined {
    return this.dialects().find(d => d.id === id);
  }
}
