import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { catchError, map, of } from 'rxjs';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isError?: boolean;
}

interface ChatResponse {
  reply: string;
  success: boolean;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AiAssistantService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl + 'aiassistant/chat';
  private readonly storageKey = 'jusoor_ai_assistant_history';

  readonly messages = signal<ChatMessage[]>(this.loadStoredMessages());
  readonly isLoading = signal<boolean>(false);
  readonly isOpen = signal<boolean>(false);
  readonly unreadCount = signal<number>(0);

  constructor() {
    if (this.messages().length === 0) {
      this.initWelcomeMessage();
    }
  }

  toggleOpen(): void {
    const newState = !this.isOpen();
    this.isOpen.set(newState);
    if (newState) {
      this.unreadCount.set(0);
    }
  }

  setOpen(open: boolean): void {
    this.isOpen.set(open);
    if (open) {
      this.unreadCount.set(0);
    }
  }

  sendMessage(userText: string, currentPage?: string): string {
    const text = userText?.trim();
    if (!text || this.isLoading()) return '';

    const userMessage: ChatMessage = {
      id: 'usr_' + Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date()
    };

    // Add user message to signals
    const currentList = [...this.messages(), userMessage];
    this.messages.set(currentList);
    this.saveMessages(currentList);

    // Check for immediate pre-saved answers for common questions
    const instantAnswer = this.getInstantAnswer(text);
    if (instantAnswer) {
      const assistantReply: ChatMessage = {
        id: 'ast_' + Date.now(),
        role: 'assistant',
        content: instantAnswer,
        timestamp: new Date(),
        isError: false
      };

      const updated = [...currentList, assistantReply];
      this.messages.set(updated);
      this.saveMessages(updated);

      if (!this.isOpen()) {
        this.unreadCount.update(c => c + 1);
      }
      return userMessage.id;
    }

    this.isLoading.set(true);

    // Format conversation history for backend API (last 8 messages)
    const apiPayload = {
      messages: currentList.slice(-8).map(m => ({
        role: m.role,
        content: m.content
      })),
      currentPage: currentPage || window.location.pathname
    };

    this.http.post<ChatResponse>(this.apiUrl, apiPayload)
      .pipe(
        catchError(err => {
          console.error('Error calling AI assistant API:', err);
          return of({
            reply: 'عذراً، حدث خطأ أثناء الاتصال بالمساعد الذكي. يرجى المحاولة مرة أخرى أو التواصل مع فريق الدعم الفني على: josour.support@gmail.com',
            success: false,
            error: err.message
          } as ChatResponse);
        })
      )
      .subscribe({
        next: (res) => {
          this.isLoading.set(false);
          const assistantReply: ChatMessage = {
            id: 'ast_' + Date.now(),
            role: 'assistant',
            content: res.reply || 'عذراً، لم أتلقَ رداً واضحاً. إذا استمرت المشكلة، يمكنك التواصل مع فريق الدعم على josour.support@gmail.com',
            timestamp: new Date(),
            isError: !res.success
          };

          const updated = [...this.messages(), assistantReply];
          this.messages.set(updated);
          this.saveMessages(updated);

          if (!this.isOpen()) {
            this.unreadCount.update(c => c + 1);
          }
        },
        error: () => {
          this.isLoading.set(false);
        }
      });

    return userMessage.id;
  }

  /**
   * Retrieves immediate pre-saved answers for common questions so users don't have to wait.
   */
  private getInstantAnswer(rawText: string): string | null {
    if (!rawText) return null;
    const t = rawText.trim().toLowerCase();

    // 1. الفرق بين شلونك وكيداير وإزيك
    if (
      t.includes('شلونك') && (t.includes('كيداير') || t.includes('إزيك') || t.includes('ازيك')) ||
      t.includes('الفرق بين شلونك') ||
      t === 'الفرق بين شلونك وكيداير وإزيك'
    ) {
      return `جميع هذه الكلمات هي تحيات يومية وسؤال عن الحال والصحة في لهجات عربية مختلفة:

- **«شلونك»**:
  - **الاستخدام**: في اللهجة العراقية والخليجية والسورية.
  - **الأصل والمعنى**: مشتقة من الفصحى: «أيُّ شيءٍ لونُك؟»، والمقصود باللون هنا هو الحال والمزاج والهيئة.
  - **الصيغ**: يُقال للرجل «شلونك»، وللمرأة «شلونچ» أو «شلونكِ»، وللجماعة «شلونكم».

- **«كيداير» (أو كي داير)**:
  - **الاستخدام**: في اللهجة المغربية (وتقابلها في الجزائر «كي راك»).
  - **الأصل والمعنى**: أصلها «كيف دائر؟»، وكلمة «داير» فصيحة من الدوران؛ أي كيف تدور أمورك وتجري أحوالك.
  - **الصيغ**: للمذكر «كيداير»، وللمؤنث «كيدايرة»، وللجمع «كيدايرين».

- **«إزيك»**:
  - **الاستخدام**: في اللهجة المصرية.
  - **الأصل والمعنى**: أصلها «إيش زيّك؟»؛ والزّي في اللغة هو الهيئة والحال؛ أي ما هو شكلك وهيئتك اليوم.
  - **الصيغ**: للمذكر «إزيك»، وللمؤنث «إزيكِ» (بكسر الكاف)، وللجمع «إزيكم».`;
    }

    // 2. كيف أشارك في مجتمع جسور؟
    if (
      (t.includes('مجتمع جسور') && (t.includes('أشارك') || t.includes('اشارك') || t.includes('مشاركة') || t.includes('تفاعل') || t.includes('انشر'))) ||
      t.includes('كيف أشارك في مجتمع جسور') ||
      t.includes('كيف اشارك في مجتمع جسور')
    ) {
      return `المشاركة والتفاعل في **مجتمع جُسور** تتم عبر خطوات بسيطة ومباشرة:

1. **الوصول للمجتمع**: انتقل إلى صفحة **«المجتمع»** من القائمة الجانبية (أو عبر الرابط \`/community\`).
2. **استكشاف المقاطع والتفاعل**: تصفح قسم «أحدث المشاركات المجتمعية» واستمع لمقاطع المتحدثين الأصليين، وتفاعل بالضغط على زر الإعجاب لتشجيعهم.
3. **المشاركة في التحدي الثقافي الأسبوعي**: انضم إلى «تحدي الأسبوع الثقافي» (مثل تحدي الأمثال الشعبية) بالضغط على زر **«شارك بالتحدي»**.
4. **نشر مقطعك الصوتي أو المرئي**: اضغط على زر **«مقطع جديد»** في القائمة الجانبية لرفع مشاركتك الخاصة وإثراء المكتبة اللهجية.
5. **لوحة الشرف**: كل تفاعل ومشاركة ترفع من ترتيبك بين المساهمين في لوحة الشرف!`;
    }

    // 3. كيف أبدأ أول تبادل لهجات؟
    if (
      (t.includes('تبادل لهجات') && (t.includes('أبدأ') || t.includes('ابدا') || t.includes('أول') || t.includes('اول') || t.includes('تسجيل') || t.includes('صوتي'))) ||
      t.includes('كيف أبدأ أول تبادل') ||
      t.includes('كيف ابدا اول تبادل')
    ) {
      return `لبدء أول تبادل لهجات في منصة **جُسور** ومشاركة لهجتك مع الجميع:

1. **فتح نافذة النشر**: اضغط على زر **«مقطع جديد»** في القائمة الجانبية أو زر **«إضافة جسر جديد»** في صفحة «جسوري» (\`/my-bridges\`).
2. **عنوان المقطع**: اكتب عنواناً جذاباً لمقطعك (مثال: «كيف نرحب بالضيوف بلهجتنا» أو «أشهر كلمات أهل الحجاز»).
3. **اختيار اللهجة**: حدد اللهجة المراد التسجيل بها من القائمة المنسدلة.
4. **نوع المقطع**: اختر بين **«صوت فقط»** لتسجيل صوتي نقي أو **«فيديو»**.
5. **رفع الملف**: اسحب الملف الصوتي أو المرئي أو اضغط لاختياره من جهازك.
6. **صورة الغلاف (اختياري)**: يمكنك اختيار صورة معبرة لتظهر كغلاف للمقطع.
7. **النشر**: اضغط على **«نشر الآن»** ليصبح تسجيلك متاحاً فوراً للمجتمع والمهتمين بتعلم لهجتك!`;
    }

    // 4. معنى كلمة "برشا" ومصدرها
    if (
      t.includes('برشا') ||
      t.includes('معنى كلمة برشا') ||
      t.includes('معنى كلمة "برشا"')
    ) {
      return `كلمة **«برشا»** هي إحدى أشهر الكلمات في اللهجة التونسية وبعض المناطق في شرق الجزائر وغرب ليبيا:

- **المعنى**: تعني **«كثيراً»** أو **«جداً»** (مثل: «يعيشك برشا» أي شكراً جزيلاً، أو «نحبك برشا» أي أحبك كثيراً).
- **الأصل اللغوي**:
  - يعود أصلها إلى الكلمة العربية الفصيحة **«بَرشَاء»** أو مشتقات **«بَرش»**، وهو لفظ في المعاجم يدل على الأرض كثيرة النبت أو الروضة المليئة بالأزهار والألوان.
  - تطورت دلالة اللفظ في شمال إفريقيا لتعبر عن الوفرة والكَثرة المطلقة.`;
    }

    // 5. كلمات ذات معانٍ مختلفة بين اللهجات
    if (
      t.includes('معانٍ مختلفة') ||
      t.includes('معاني مختلفة') ||
      t.includes('كلمات ذات معان') ||
      t.includes('متشابهة في النطق') ||
      t.includes('متناقضة بين اللهجات')
    ) {
      return `تتميز اللهجات العربية بوجود كلمات متطابقة في اللفظ لكن معناها يختلف كلياً من بلد لآخر:

- **«يعطيك العافية»**:
  - في المشرق ومصر والخليج: دعاء بالصحة والنشاط والخير.
  - في المغرب وتونس: كلمة «العافية» قد تعني النار؛ لذا يُفضّل المغاربة قول «الله يعطيك الصحة».

- **«مبسوط»**:
  - في مصر والشام: تعني سعيد ومسرور.
  - في بعض اللهجات المغاربية قديماً: قد تعني ممدد أو مستلقٍ.

- **«العَرَصة»**:
  - في الخليج والعراق: تعني الساحة الواسعة أو البقعة من الأرض غير المبنية (وهو أصلها الفصيح).
  - في مصر والشام: كلمة غير لائقة ومذمومة.

- **كلمات التعبير عن الإرادة (أريد)**:
  - مصر: «عايز» | الشام: «بدي» | الخليج: «أبغى» أو «أبي» | تونس: «نحب» | المغرب: «بغيت» أو «داير».

- **كلمات التعبير عن اللحظة الحالية (الآن)**:
  - مصر: «دلوقتي» | العراق والشام: «هسّه» | الخليج: «الحين» | المغرب: «دابا» | تونس: «توّا».`;
    }

    // 6. كيف أنشر أو أضيف مقطع / جسر جديد
    if (
      (t.includes('كيف') && (t.includes('انشر') || t.includes('أنشر') || t.includes('ارفع') || t.includes('أرفع') || t.includes('اضيف') || t.includes('أضيف'))) ||
      t.includes('طريقة النشر') ||
      t.includes('اضافة جسر') ||
      t.includes('إضافة جسر')
    ) {
      return `خطوات نشر مقطع جديد أو إضافة جسر في منصة **جُسور**:

1. اضغط على زر **«مقطع جديد»** الموجود دائماً في القائمة الجانبية (أو من صفحة «جسوري» أو «المجتمع»).
2. ستفتح لك نافذة **«إضافة جسر جديد»**.
3. اكتب **عنوان المقطع** (مثال: «شرح مثل شعبي حجازي»).
4. اختر **اللهجة** من القائمة المنسدلة.
5. (اختياري) اكتب **وصفاً قصيراً** للمقطع لمساعدة الآخرين على فهم السياق.
6. حدد نوع المقطع: **«فيديو»** أو **«صوت فقط»**.
7. اضغط على **«اسحب الملف هنا أو اضغط للاختيار»** لاختيار الملف من جهازك.
8. (اختياري) اختر صورة مصغرة كغلاف للمقطع.
9. اضغط على زر **«نشر الآن»** وسيُنشر المقطع فوراً في المنصة!`;
    }

    // 7. التواصل مع الدعم الفني
    if (
      t.includes('الدعم') ||
      t.includes('دعم فني') ||
      t.includes('josour.support') ||
      t.includes('تواصل مع') ||
      t.includes('خدمة العملاء') ||
      t.includes('مشكلة في الحساب')
    ) {
      return `يسعد فريق الدعم الفني لمنصة **جُسور** بمساعدتك وحل أي مشكلة تواجهها:

- **البريد الإلكتروني للدعم الفني**: \`josour.support@gmail.com\`
- **طريقة التواصل من الإعدادات**: يمكنك الانتقال إلى صفحة **«الإعدادات»** (\`/settings\`) والاطلاع على قسم «الدعم الفني» لمراسلتنا بضغطة زر أو نسخ البريد.

إذا كان لديك أي عطل تقني، استفسار عن حسابك، أو اقتراح لتطوير المنصة، راسلنا وسيقوم الفريق بالرد عليك في أقرب وقت.`;
    }

    return null;
  }

  clearHistory(): void {
    localStorage.removeItem(this.storageKey);
    this.messages.set([]);
    this.initWelcomeMessage();
  }

  private initWelcomeMessage(): void {
    const welcome: ChatMessage = {
      id: 'ast_welcome',
      role: 'assistant',
      content: `أهلاً بك في منصة **جُسور**.
أنا **مساعد جسور**، دليلك في استكشاف وفهم اللهجات العربية واستخدام مميزات المنصة.

**مجالات المساعدة:**
- شرح معاني الكلمات والعبارات في مختلف اللهجات العربية ومقارنتها.
- توضيح الفروق الدقيقة بين الكلمات المشتركة وتفادي سوء الفهم.
- إرشادك في استخدام المنصة، مثل تسجيل التبادلات الصوتية والمرئية، والتفاعل في مجتمع جسور.

يمكنك اختيار أحد الأسئلة المقترحة أدناه أو كتابة استفسارك مباشرة.`,
      timestamp: new Date()
    };
    this.messages.set([welcome]);
  }

  private loadStoredMessages(): ChatMessage[] {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return parsed.map((m: any) => ({
        ...m,
        timestamp: new Date(m.timestamp)
      }));
    } catch {
      return [];
    }
  }

  private saveMessages(msgs: ChatMessage[]): void {
    try {
      // Save at most the last 25 messages to keep storage light
      const trimmed = msgs.slice(-25);
      localStorage.setItem(this.storageKey, JSON.stringify(trimmed));
    } catch (e) {
      console.warn('Could not save chat messages to localStorage', e);
    }
  }
}
