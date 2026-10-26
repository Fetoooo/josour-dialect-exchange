import { Component, inject, signal, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AppSettingsService } from '../../core/services/app-settings.service';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss'
})
export class LandingComponent implements OnInit, OnDestroy, AfterViewInit {
  authService = inject(AuthService);
  appSettings = inject(AppSettingsService);
  activeDialect = signal(0);
  visibleSections = signal<Set<string>>(new Set());
  mobileMenuOpen = signal(false);
  private intervalId: any;
  private observer!: IntersectionObserver;

  toggleDarkMode() {
    const isDark = this.appSettings.settings().darkMode;
    this.appSettings.update({ darkMode: !isDark });
  }

  toggleMobileMenu() {
    this.mobileMenuOpen.update(v => !v);
  }

  closeMobileMenu() {
    this.mobileMenuOpen.set(false);
  }

  dialects = [
    { name: 'المصرية', flag: '🇪🇬', phrase: 'إزيك؟ عامل إيه؟', translation: 'كيف حالك؟', color: '#c0392b' },
    { name: 'الخليجية', flag: '🇸🇦', phrase: 'شلونك؟ كيف الأحوال؟', translation: 'كيف حالك؟', color: '#16a085' },
    { name: 'الشامية', flag: '🇸🇾', phrase: 'كيفك؟ شو أخبارك؟', translation: 'كيف حالك؟', color: '#8e44ad' },
    { name: 'المغربية', flag: '🇲🇦', phrase: 'لاباس؟ كيداير؟', translation: 'كيف حالك؟', color: '#d35400' },
    { name: 'العراقية', flag: '🇮🇶', phrase: 'شلونك؟ بخير وين؟', translation: 'كيف حالك؟', color: '#2980b9' },
  ];

  features = [
    { icon: '🎙️', title: 'تبادل صوتي حقيقي', desc: 'استمع لأهل اللهجة وارفع مقاطعك الصوتية مباشرة' },
    { icon: '🎬', title: 'محتوى ترفيهي', desc: 'أفلام وأغاني ومسلسلات مصنّفة حسب اللهجة مع شرح تفاعلي' },
    { icon: '📝', title: 'نصوص تفاعلية', desc: 'كل كلمة قابلة للنقر مع ترجمة وشرح ثقافي فوري' },
    { icon: '📹', title: 'محادثة فيديو مباشرة', desc: 'تواصل وجهاً لوجه مع متحدثين أصليين مجاناً' },
    { icon: '🗺️', title: 'خريطة اللهجات', desc: 'استكشف 12 لهجة عربية من المحيط إلى الخليج' },
    { icon: '🏆', title: 'نظام الإنجازات', desc: 'اكسب نقاطاً وشاراتك كلما تعلمت لهجة جديدة' },
  ];

  currentYear = new Date().getFullYear();

  stats = [
    { num: '12', label: 'لهجة عربية', icon: 'language' },
    { num: '+350M', label: 'متحدث عربي', icon: 'people' },
    { num: '22', label: 'دولة عربية', icon: 'public' },
    { num: '100%', label: 'مجاني تماماً', icon: 'volunteer_activism' },
  ];

  ngOnInit() {
    this.intervalId = setInterval(() => {
      this.activeDialect.update(i => (i + 1) % this.dialects.length);
    }, 2500);
  }

  ngAfterViewInit() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.visibleSections.update(s => new Set(s).add(entry.target.id));
          }
        });
      },
      { threshold: 0.15 }
    );
    document.querySelectorAll('.observe-me').forEach(el => this.observer.observe(el));
  }

  ngOnDestroy() {
    clearInterval(this.intervalId);
    this.observer?.disconnect();
  }

  isVisible(id: string): boolean {
    return this.visibleSections().has(id);
  }
}