import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppSettingsService } from './core/services/app-settings.service';
import { AiAssistantComponent } from './features/ai-assistant/ai-assistant.component';
import { MobileNavComponent } from './features/mobile-nav/mobile-nav.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AiAssistantComponent, MobileNavComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly appSettings = inject(AppSettingsService);
  protected readonly title = signal('dialect-exchange-frontend');
}
