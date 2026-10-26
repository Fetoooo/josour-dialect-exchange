import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { App } from './app';
import { AppSettingsService } from './core/services/app-settings.service';
import { AuthService } from './core/services/auth.service';
import { NotificationService } from './core/services/notification.service';
import { AiAssistantService } from './core/services/ai-assistant.service';
import { signal } from '@angular/core';

describe('App', () => {
  beforeEach(async () => {
    const mockAuthService = {
      currentUser: signal(null),
      validateCurrentSession: vi.fn().mockReturnValue(false),
      logout: vi.fn()
    };

    const mockNotificationService = {
      unreadCount: signal(0),
      unreadMessagesCount: signal(0),
      notifications: signal([])
    };

    const mockAiService = {
      messages: signal([]),
      isLoading: signal(false),
      isOpen: signal(false)
    };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideAnimationsAsync(),
        AppSettingsService,
        { provide: AuthService, useValue: mockAuthService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: AiAssistantService, useValue: mockAiService }
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
