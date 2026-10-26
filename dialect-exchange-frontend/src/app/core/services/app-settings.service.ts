import { Injectable, signal } from '@angular/core';

export interface AppSettings {
  messageNotifications: boolean;
  soundEffects: boolean;
  compactLayout: boolean;
  darkMode: boolean;
  sidebarCollapsed?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AppSettingsService {
  private readonly storageKey = 'jusoor-settings';
  private readonly defaults: AppSettings = {
    messageNotifications: true,
    soundEffects: true,
    compactLayout: false,
    darkMode: false,
    sidebarCollapsed: false
  };

  readonly settings = signal<AppSettings>(this.read());

  constructor() {
    const current = this.settings();
    this.applyLayout(current.compactLayout);
    this.applyTheme(current.darkMode);
    this.applySidebar(!!current.sidebarCollapsed);
  }

  toggleSidebar(): void {
    const next = !this.settings().sidebarCollapsed;
    this.update({ sidebarCollapsed: next });
  }

  update(next: Partial<AppSettings>): void {
    const settings = { ...this.settings(), ...next };
    this.settings.set(settings);
    localStorage.setItem(this.storageKey, JSON.stringify(settings));
    this.applyLayout(settings.compactLayout);
    this.applyTheme(settings.darkMode);
    this.applySidebar(!!settings.sidebarCollapsed);
  }

  reset(): void {
    this.settings.set({ ...this.defaults });
    localStorage.setItem(this.storageKey, JSON.stringify(this.defaults));
    this.applyLayout(false);
    this.applyTheme(false);
    this.applySidebar(false);
  }

  private read(): AppSettings {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (!saved) return { ...this.defaults };

      const savedSettings = JSON.parse(saved) as Partial<AppSettings>;
      return { ...this.defaults, ...savedSettings };
    } catch {
      return { ...this.defaults };
    }
  }

  private applyLayout(compact: boolean): void {
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('compact-layout', compact);
    }
  }

  private applyTheme(dark: boolean): void {
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('dark-theme', dark);
      document.documentElement.classList.toggle('dark-theme', dark);
      if (dark) {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    }
  }

  private applySidebar(collapsed: boolean): void {
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('sidebar-collapsed', collapsed);
      document.documentElement.classList.toggle('sidebar-collapsed', collapsed);
    }
  }
}
