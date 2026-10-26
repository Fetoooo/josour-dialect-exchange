import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ExchangeService } from '../../core/services/exchange.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { UploadDialogComponent } from '../upload-dialog/upload-dialog.component';

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';

interface Dialect {
  id: string;
  nameAr: string;
  nameEn: string;
  country: string;
  flag: string;
  description: string;
  speakers: string;
  color: string;
  bg1: string;
  bg2: string;
  icon: string;
  phrase: string;
  iconic: string;
  pattern: string;
  exchangeCount: number;
  image: string;
}

import { AppSettingsService } from '../../core/services/app-settings.service';

@Component({
  selector: 'app-explore',
  standalone: true,
  imports: [
    CommonModule, RouterLink, RouterLinkActive, MatDialogModule, MatToolbarModule,
    MatButtonModule, MatIconModule, MatSidenavModule, MatCardModule,
    MatMenuModule, MatChipsModule
  ],
  templateUrl: './explore.component.html',
  styleUrl: './explore.component.scss'
})
export class ExploreComponent {
  public authService = inject(AuthService);
  public appSettings = inject(AppSettingsService);
  private dialog = inject(MatDialog);
  private router = inject(Router);
  searchQuery = signal<string>('');

  dialects = signal<Dialect[]>([
    {
      id: '1', nameAr: 'المصرية', nameEn: 'Egyptian', country: 'مصر', flag: '🇪🇬',
      description: 'أكثر اللهجات انتشاراً وتأثيراً في العالم العربي، يفهمها كل العرب',
      speakers: '100 مليون', exchangeCount: 0,
      color: '#c0392b', bg1: '#c0392b', bg2: '#7b241c',
      image: 'https://images.unsplash.com/photo-1572252009286-268acec5ca0a?w=600&q=80', // Nile/Cairo
      icon: '🏛️', phrase: 'إزيك؟', iconic: 'أرض الفراعنة', pattern: 'egypt'
    },
    {
      id: '2', nameAr: 'الشامية', nameEn: 'Levantine', country: 'سوريا / لبنان / فلسطين', flag: '🇸🇾',
      description: 'لهجة رقيقة ومحببة تجمع بين الأصالة والحداثة',
      speakers: '35 مليون', exchangeCount: 0,
      color: '#0d7a55', bg1: '#0d7a55', bg2: '#064d35',
      image: 'https://images.unsplash.com/photo-1580834341580-8c17a3a630ca?w=500&q=80',
      icon: '🌹', phrase: 'كيفك؟', iconic: 'دمشق العريقة', pattern: 'levant'
    },
    {
      id: '3', nameAr: 'الخليجية', nameEn: 'Gulf', country: 'السعودية / الإمارات / الكويت', flag: '🇸🇦',
      description: 'لهجة ذات جذور عريقة في الجزيرة العربية، غنية بالمفردات البدوية',
      speakers: '60 مليون', exchangeCount: 0,
      color: '#1a5c38', bg1: '#1a5c38', bg2: '#0a2e1c',
      image: 'https://images.unsplash.com/photo-1512632578888-169bbbc64f33?w=500&q=80',
      icon: '🌴', phrase: 'شلونك؟', iconic: 'نخيل الخليج', pattern: 'gulf'
    },
    {
      id: '4', nameAr: 'العراقية', nameEn: 'Iraqi', country: 'العراق', flag: '🇮🇶',
      description: 'لهجة قديمة ذات إيقاع موسيقي فريد، تحتفظ بكثير من الألفاظ الأصيلة',
      speakers: '40 مليون', exchangeCount: 0,
      color: '#2e7d32', bg1: '#1b5e20', bg2: '#111',
      image: 'https://images.unsplash.com/photo-1534067783941-51c9c23ecefd?auto=format&fit=crop&q=80&w=800', // Baghdad/Iraq architecture
      icon: '🏺', phrase: 'شگولك؟', iconic: 'بلاد الرافدين', pattern: 'iraq'
    },
    {
      id: '5', nameAr: 'المغربية', nameEn: 'Moroccan', country: 'المغرب', flag: '🇲🇦',
      description: 'دارجة فريدة تمزج العربية بالأمازيغية والفرنسية والإسبانية',
      speakers: '40 مليون', exchangeCount: 0,
      color: '#c1272d', bg1: '#c1272d', bg2: '#7b0d10',
      image: 'https://images.unsplash.com/photo-1489493887464-892be6d1daae?w=500&q=80',
      icon: '🕌', phrase: 'لاباس؟', iconic: 'زليج مراكش', pattern: 'morocco'
    },
    {
      id: '6', nameAr: 'التونسية', nameEn: 'Tunisian', country: 'تونس', flag: '🇹🇳',
      description: 'لهجة تمتزج فيها الأصالة العربية بالتأثيرات المتوسطية',
      speakers: '12 مليون', exchangeCount: 0,
      color: '#c0392b', bg1: '#c0392b', bg2: '#6e1a15',
      image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Amphitheatre%20of%20El%20Jem.jpg?width=1000',
      icon: '🫒', phrase: 'لاباس؟', iconic: 'زيتون تونس', pattern: 'tunisia'
    },
    {
      id: '7', nameAr: 'الجزائرية', nameEn: 'Algerian', country: 'الجزائر', flag: '🇩🇿',
      description: 'لهجة متنوعة تعكس التاريخ الغني للجزائر من حضارات متعددة',
      speakers: '45 مليون', exchangeCount: 0,
      color: '#006233', bg1: '#006233', bg2: '#003d1f',
      image: 'https://images.unsplash.com/photo-1548013146-72479768bada?w=500&q=80',
      icon: '☪️', phrase: 'واش راك؟', iconic: 'القصبة العتيقة', pattern: 'algeria'
    },
    {
      id: '8', nameAr: 'الليبية', nameEn: 'Libyan', country: 'ليبيا', flag: '🇱🇾',
      description: 'لهجة تجمع بين تأثيرات شمال أفريقيا والجزيرة العربية',
      speakers: '7 مليون', exchangeCount: 0,
      color: '#239e46', bg1: '#111', bg2: '#239e46',
      image: 'https://images.unsplash.com/photo-1509233725247-49e657c54213?w=500&q=80',
      icon: '🦅', phrase: 'كيف حالك؟', iconic: 'صحراء ليبيا', pattern: 'libya'
    },
    {
      id: '9', nameAr: 'اليمنية', nameEn: 'Yemeni', country: 'اليمن', flag: '🇾🇪',
      description: 'لهجة قديمة جداً، تحافظ على ألفاظ من العربية الفصحى القديمة',
      speakers: '30 مليون', exchangeCount: 0,
      color: '#ce1126', bg1: '#ce1126', bg2: '#1a1a1a',
      image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Dar%20al-Hajar%2C%20Yemen.jpg?width=1000',
      icon: '🇾🇪', phrase: 'كيف حالك؟', iconic: 'العلم اليماني', pattern: 'yemen'
    },
    {
      id: '10', nameAr: 'الأردنية', nameEn: 'Jordanian', country: 'الأردن', flag: '🇯🇴',
      description: 'لهجة شامية بنكهة خاصة، سهلة الفهم ومحببة للسمع',
      speakers: '10 مليون', exchangeCount: 0,
      color: '#007a3d', bg1: '#007a3d', bg2: '#ce1126',
      image: 'https://images.unsplash.com/photo-1543731068-7e0f5beff43a?auto=format&fit=crop&q=80&w=800',
      icon: '🧂', phrase: 'كيفك؟', iconic: 'شواطئ البحر الميت', pattern: 'jordan'
    },
    {
      id: '11', nameAr: 'الفلسطينية', nameEn: 'Palestinian', country: 'فلسطين', flag: '🇵🇸',
      description: 'لهجة شامية أصيلة تحمل إرثاً ثقافياً وتاريخياً عميقاً',
      speakers: '14 مليون', exchangeCount: 0,
      color: '#2e7d32', bg1: '#111', bg2: '#2e7d32',
      image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Dome_of_the_rock.jpg?width=800',
      icon: '🇵🇸', phrase: 'كيفك؟', iconic: 'أزقة القدس العتيقة', pattern: 'palestine'
    },
    {
      id: '12', nameAr: 'السودانية', nameEn: 'Sudanese', country: 'السودان', flag: '🇸🇩',
      description: 'لهجة ذات إيقاع موسيقي دافئ، تمزج العربية بتأثيرات أفريقية',
      speakers: '45 مليون', exchangeCount: 0,
      color: '#d21034', bg1: '#d21034', bg2: '#078930',
      image: 'https://images.unsplash.com/photo-1506461883276-594a12b11cf3?auto=format&fit=crop&q=80&w=800',
      icon: '⛵', phrase: 'كيف الحال؟', iconic: 'غروب النيل الأزرق', pattern: 'sudan'
    },
  ]);

  filteredDialects = computed(() => {
    const q = this.searchQuery().toLowerCase();
    return q ? this.dialects().filter(d =>
      d.nameAr.includes(q) || d.nameEn.toLowerCase().includes(q) || d.country.includes(q)
    ) : this.dialects();
  });

  onSearch(v: string) { this.searchQuery.set(v); }
  clearSearch() { this.searchQuery.set(''); }

  exploreDialect(d: Dialect) {
    this.router.navigate(['/dialect', d.id]);
  }
  logout() { this.authService.logout(); this.router.navigate(['/login']); }
  openUploadDialog() {
    this.dialog.open(UploadDialogComponent, { width: '500px', panelClass: 'jusoor-glass-dialog' }).afterClosed().subscribe();
  }
}