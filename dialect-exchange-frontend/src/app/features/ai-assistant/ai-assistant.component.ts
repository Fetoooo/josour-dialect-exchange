import {
  Component,
  ElementRef,
  ViewChild,
  inject,
  AfterViewChecked,
  HostListener,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AiAssistantService, ChatMessage } from '../../core/services/ai-assistant.service';
import { AppSettingsService } from '../../core/services/app-settings.service';

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './ai-assistant.component.html',
  styleUrls: ['./ai-assistant.component.scss']
})
export class AiAssistantComponent implements AfterViewChecked {
  readonly aiService = inject(AiAssistantService);
  readonly appSettings = inject(AppSettingsService);

  userInput: string = '';
  readonly showConfirmClear = signal<boolean>(false);
  private targetScrollId: string | null = null;

  @ViewChild('messagesScroll') private messagesScrollContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('inputField') private inputFieldElement?: ElementRef<HTMLTextAreaElement>;

  // Clean suggestion chips without emojis
  readonly suggestionChips = [
    { label: 'الفرق بين شلونك وكيداير وإزيك', text: 'ما الفرق بين كلمة "شلونك" و"كيداير" و"إزيك"؟ وكيف تستخدم كل منها؟' },
    { label: 'كيف أشارك في مجتمع جسور؟', text: 'كيف يمكنني نشر مشاركة أو مناقشة اللهجات في مجتمع جسور والتفاعل مع الآخرين؟' },
    { label: 'كيف أبدأ أول تبادل لهجات؟', text: 'كيف أبدأ أول تبادل لهجات في منصة جسور وأسجل مقطعاً صوتياً؟' },
    { label: 'معنى كلمة "برشا" ومصدرها', text: 'ما معنى كلمة "برشا" في اللهجة التونسية والمغاربية وما هو أصلها اللغوي؟' },
    { label: 'كلمات ذات معانٍ مختلفة بين اللهجات', text: 'ما هي أشهر الكلمات العربية المتشابهة في النطق ولكن لها معاني مختلفة أو متناقضة بين اللهجات؟' }
  ];

  ngAfterViewChecked(): void {
    // Handled via targeted message scrolling
  }

  toggleChat(): void {
    this.aiService.toggleOpen();
    if (this.aiService.isOpen()) {
      setTimeout(() => {
        this.inputFieldElement?.nativeElement.focus();
      }, 200);
    }
  }

  closeChat(): void {
    this.aiService.setOpen(false);
    this.showConfirmClear.set(false);
  }

  send(): void {
    const text = this.userInput.trim();
    if (!text || this.aiService.isLoading()) return;

    const msgId = this.aiService.sendMessage(text);
    this.userInput = '';
    if (msgId) {
      this.scrollToMessage(msgId);
    }
  }

  selectSuggestion(text: string): void {
    if (this.aiService.isLoading()) return;
    const msgId = this.aiService.sendMessage(text);
    if (msgId) {
      this.scrollToMessage(msgId);
    }
  }

  private scrollToMessage(msgId: string): void {
    this.targetScrollId = msgId;
    this.performScroll();
    setTimeout(() => this.performScroll(), 40);
    setTimeout(() => this.performScroll(), 140);
  }

  private performScroll(): void {
    if (!this.targetScrollId || !this.messagesScrollContainer) return;
    try {
      const container = this.messagesScrollContainer.nativeElement;
      const targetEl = container.querySelector(`[data-id="${this.targetScrollId}"]`) as HTMLElement;
      if (targetEl) {
        const containerRect = container.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        const relativeTop = targetRect.top - containerRect.top + container.scrollTop;

        container.scrollTo({
          top: Math.max(0, relativeTop - 12),
          behavior: 'smooth'
        });
      }
    } catch {
      // Ignore scroll errors
    }
  }

  openClearConfirm(): void {
    this.showConfirmClear.set(true);
  }

  cancelClearConfirm(): void {
    this.showConfirmClear.set(false);
  }

  confirmClearHistory(): void {
    this.aiService.clearHistory();
    this.showConfirmClear.set(false);
  }

  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showConfirmClear()) {
      this.cancelClearConfirm();
      return;
    }
    if (this.aiService.isOpen()) {
      this.closeChat();
    }
  }

  private scrollToBottom(): void {
    try {
      if (this.messagesScrollContainer) {
        const el = this.messagesScrollContainer.nativeElement;
        el.scrollTop = el.scrollHeight;
      }
    } catch {
      // Ignore scroll errors
    }
  }

  /**
   * Helper to format markdown elements safely (headings, bold, lists, code, tables)
   */
  formatMessage(text: string): string {
    if (!text) return '';

    // 1. Remove any stray emojis if any exist
    let formatted = text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');

    // 2. HTML Escape to prevent XSS
    formatted = formatted
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 3. Convert markdown tables before converting line breaks
    formatted = this.parseMarkdownTables(formatted);

    // 4. Headings: ### Title or ## Title
    formatted = formatted.replace(/^#{2,4}\s+(.*?)$/gm, '<h4 class="chat-heading">$1</h4>');

    // 5. Bold: **text**
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // 6. Italic: *text*
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // 7. Inline code: `code`
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 8. Bullet list items: - or * at start of line
    formatted = formatted.replace(/^[\*\-]\s+(.*)$/gm, '<li class="chat-li">$1</li>');

    // 9. Numbered list items: 1. 2. etc.
    formatted = formatted.replace(/^(\d+)\.\s+(.*)$/gm, '<li class="chat-li-num"><span class="num">$1.</span> $2</li>');

    // 10. Clean line breaks (preserving table structure)
    formatted = formatted.replace(/\n/g, '<br>');

    // Clean up multiple consecutive <br> after headings or tables
    formatted = formatted.replace(/(<\/h4>)<br>/g, '$1');
    formatted = formatted.replace(/(<\/table>)<br>/g, '$1');

    return formatted;
  }

  /**
   * Converts standard markdown tables (| header | header |) into styled HTML tables
   */
  private parseMarkdownTables(content: string): string {
    const tableRegex = /((?:\|[^\n]+\|\r?\n)+)/g;
    return content.replace(tableRegex, (match) => {
      const lines = match.trim().split(/\r?\n/).filter(line => line.includes('|'));
      if (lines.length < 2) return match;

      let html = '<div class="chat-table-wrapper"><table class="chat-table">';
      let isHeader = true;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Skip separator row like |---|---|
        if (/^\|[\s\-:]+\|\s*$/.test(line) || /^\|(?:\s*[:-]+[\s:-]*\|)+$/.test(line)) {
          isHeader = false;
          continue;
        }

        const cells = line.split('|').slice(1, -1).map(c => c.trim());
        if (cells.length === 0) continue;

        if (isHeader && i === 0) {
          html += '<thead><tr>';
          cells.forEach(cell => {
            html += `<th>${cell}</th>`;
          });
          html += '</tr></thead><tbody>';
          isHeader = false;
        } else {
          html += '<tr>';
          cells.forEach(cell => {
            html += `<td>${cell}</td>`;
          });
          html += '</tr>';
        }
      }

      html += '</tbody></table></div>';
      return html;
    });
  }
}
