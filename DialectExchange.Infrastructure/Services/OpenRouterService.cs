using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using DialectExchange.Core.DTOs;
using DialectExchange.Core.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace DialectExchange.Infrastructure.Services
{
    public class OpenRouterService : IAiAssistantService
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _config;
        private readonly ILogger<OpenRouterService> _logger;

        private const string DefaultSystemPrompt = """
            أنت "مساعد جسور" - المرشد وخبير اللهجات العربية الذكي لمنصة «جُسور» (DialectExchange).

            قواعد صارمة للأسلوب والصياغة:
            1. اللغة: اكتب باللغة العربية الفصحى السليمة والواضحة فقط، مع وضع الكلمات والعبارات اللهجية بين علامات تنصيص صغيرة «». يُمنع منعاً باتاً كتابة أي أحرف غير عربية (صينية، كورية، يابانية وغيرها)، ويُمنع إقحام كلمات إنجليزية عشوائية داخل الجمل العربية.
            2. الرموز التعبيرية: يُمنع منعاً باتاً استخدام الرموز التعبيرية (Emojis) نهائياً في أي جزء من الإجابة.
            3. التنسيق: نسق إجاباتك في نقاط مرقمة أو فقرات موجزة وواضحة جداً، مع استخدام الخط العريض **للكلمات الرئيسية** فقط. تجنب كثرة العناوين الرمزية مثل ### وتجنب جداول الرموز المعقدة.
            4. الاكتمال: يجب أن تنهي إجابتك وفكرتك بالكامل حتى آخر جملة. لا تتوقف في منتصف الشرح أبداً.

            قاعدة الدعم الفني والاستفسارات غير المؤكدة (إلزامية وحاسمة):
            - البريد الإلكتروني الرسمي للدعم الفني لمنصة جسور هو: josour.support@gmail.com
            - إذا سُئلت عن أي سؤال غير متأكد من إجابته بنسبة 100%، أو واجه المستخدم مشكلة فنية أو تقنية في حسابه (مثل مشاكل تسجيل الدخول، فقدان كلمة المرور، أخطاء في الرفع، أو أعطال في المنصة)، يجب عليك ألا تخمن، بل اذكر له ما تعرفه بإيجاز ثم وجهه صراحة وبوضوح للتواصل مع فريق الدعم الفني على البريد: josour.support@gmail.com، وأخبره أنه يمكنه أيضاً الوصول لقسم «الدعم الفني» في صفحة الإعدادات (/settings) لنسخ البريد أو المراسلة المباشرة.

            مهامك ومعرفتك الدقيقة بمنصة «جُسور»:
            1. خبير اللهجات العربية:
               - تشرح معاني الكلمات والعبارات وأصلها اللغوي الفصيح في مختلف اللهجات العربية (المصرية، الشامية، الخليجية، المغاربية، العراقية، السودانية، اليمنية).
               - توضح بدقة الفروق بين اللهجات والكلمات المشتركة في اللفظ والمختلفة في المعنى، وتساعد المستخدمين على تفادي سوء الفهم الثقافي.

            2. المرشد الشامل لخطوات وميزات المنصة:
               - كيفية نشر مقطع جديد أو إضافة جسر في المنصة:
                 1. الضغط على زر «مقطع جديد» في القائمة الجانبية (أو من صفحة «جسوري» /my-bridges أو «المجتمع» /community).
                 2. تفتح نافذة «إضافة جسر جديد».
                 3. كتابة «عنوان المقطع» (مثال: شرح مثل شعبي، معنى كلمة دارجة).
                 4. اختيار «اللهجة» من القائمة المنسدلة.
                 5. كتابة «وصف المقطع» (اختياري) لتوضيح السياق.
                 6. تحديد «نوع المقطع»: فيديو أو صوت فقط.
                 7. رفع الملف عبر الضغط على خانة «اسحب الملف هنا أو اضغط للاختيار».
                 8. اختيار صورة مصغرة كغلاف للمقطع (اختياري).
                 9. الضغط على «نشر الآن» ليصبح المقطع متاحاً للجميع.

               - المشاركة والتفاعل في المجتمع (/community):
                 - الاستماع لمقاطع المتحدثين الأصليين عبر زر «استمع الآن» أو «شاهد الآن».
                 - التفاعل بالإعجاب بالمقاطع لدعم أصحابها وزيادة نقاطهم في لوحة الشرف (Leaderboard).
                 - المشاركة في «تحدي الأسبوع الثقافي» بالضغط على زر «شارك بالتحدي».

               - استكشاف اللهجات (/explore):
                 - تصفح اللهجات المتنوعة وتصفيتها حسب الدولة والمنطقة لسماع النطق الأصلي لمفرداتها.

               - التبادل المباشر والرسائل ومكالمات الفيديو (/messages و /video-call):
                 - التراسل المباشر ومحادثة شركاء التبادل اللغوي بالصوت أو النص، وبدء مكالمات فيديو لممارسة اللهجة حياً.

               - الإعدادات والدعم الفني (/settings):
                 - ضبط الإشعارات والمؤثرات الصوتية، تفعيل الوضع الليلي (Dark Mode)، والوصول لقسم «الدعم الفني» للتواصل المباشر مع فريق الدعم عبر البريد josour.support@gmail.com.
            """;

        public OpenRouterService(HttpClient httpClient, IConfiguration config, ILogger<OpenRouterService> logger)
        {
            _httpClient = httpClient;
            _config = config;
            _logger = logger;
        }

        public async Task<AiChatResponseDto> GetChatResponseAsync(List<AiChatMessageDto> messages, string? userContext = null)
        {
            var apiKey = _config["OpenRouter:ApiKey"];
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                _logger.LogWarning("OpenRouter API Key is missing in configuration.");
                return new AiChatResponseDto
                {
                    Success = false,
                    Error = "لم يتم ضبط مفتاح OpenRouter في إعدادات السيرفر.",
                    Reply = "عذراً، لم يتم ضبط مفتاح الخدمة في إعدادات المنصة."
                };
            }

            var primaryModel = _config["OpenRouter:Model"] ?? "nvidia/nemotron-3-ultra-550b-a55b:free";
            var fallbackModel = _config["OpenRouter:FallbackModel"] ?? "nvidia/nemotron-3.5-lightning:free";
            var baseUrl = _config["OpenRouter:BaseUrl"] ?? "https://openrouter.ai/api/v1/";

            // Try primary model first
            var response = await CallOpenRouterApiAsync(baseUrl, apiKey, primaryModel, messages, userContext);
            if (response.Success)
            {
                return response;
            }

            // Fallback if primary failed
            if (!string.IsNullOrWhiteSpace(fallbackModel) && fallbackModel != primaryModel)
            {
                _logger.LogWarning("Primary model {PrimaryModel} failed. Attempting fallback model {FallbackModel}...", primaryModel, fallbackModel);
                var fallbackResponse = await CallOpenRouterApiAsync(baseUrl, apiKey, fallbackModel, messages, userContext);
                if (fallbackResponse.Success)
                {
                    return fallbackResponse;
                }
            }

            return response;
        }

        private async Task<AiChatResponseDto> CallOpenRouterApiAsync(
            string baseUrl,
            string apiKey,
            string model,
            List<AiChatMessageDto> messages,
            string? userContext)
        {
            try
            {
                var systemContent = DefaultSystemPrompt;
                if (!string.IsNullOrWhiteSpace(userContext))
                {
                    systemContent += $"\n\nمعلومات المستخدم الحالي:\n{userContext}";
                }

                var formattedMessages = new List<object>
                {
                    new { role = "system", content = systemContent }
                };

                var recentMessages = messages.TakeLast(6);
                foreach (var msg in recentMessages)
                {
                    var role = (msg.Role?.ToLowerInvariant() == "assistant") ? "assistant" : "user";
                    if (!string.IsNullOrWhiteSpace(msg.Content))
                    {
                        formattedMessages.Add(new { role, content = msg.Content.Trim() });
                    }
                }

                var requestPayload = new
                {
                    model = model,
                    messages = formattedMessages,
                    temperature = 0.35,
                    max_tokens = 2500
                };

                var jsonOptions = new JsonSerializerOptions
                {
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
                };

                var endpointUrl = baseUrl.TrimEnd('/') + "/chat/completions";
                using var request = new HttpRequestMessage(HttpMethod.Post, endpointUrl);
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
                request.Headers.Add("HTTP-Referer", "http://localhost:4200");
                request.Headers.Add("X-Title", "DialectExchange");

                var jsonBody = JsonSerializer.Serialize(requestPayload, jsonOptions);
                request.Content = new StringContent(jsonBody, Encoding.UTF8, "application/json");

                var httpResponse = await _httpClient.SendAsync(request);
                var responseContent = await httpResponse.Content.ReadAsStringAsync();

                if (!httpResponse.IsSuccessStatusCode)
                {
                    _logger.LogError("OpenRouter API returned error status {StatusCode} for model {Model}: {Content}", 
                        httpResponse.StatusCode, model, responseContent);

                    return new AiChatResponseDto
                    {
                        Success = false,
                        Error = $"OpenRouter error: {httpResponse.StatusCode}",
                        Reply = "عذراً، يواجه السيرفر ضغطاً مؤقتاً في معالجة الطلب. يرجى المحاولة بعد لحظات."
                    };
                }

                using var doc = JsonDocument.Parse(responseContent);
                var root = doc.RootElement;
                if (root.TryGetProperty("choices", out var choices) && choices.GetArrayLength() > 0)
                {
                    var firstChoice = choices[0];
                    if (firstChoice.TryGetProperty("message", out var messageProp) &&
                        messageProp.TryGetProperty("content", out var contentProp))
                    {
                        var rawReply = contentProp.GetString() ?? string.Empty;
                        var cleanedReply = CleanOutput(rawReply);

                        return new AiChatResponseDto
                        {
                            Success = true,
                            Reply = cleanedReply
                        };
                    }
                }

                return new AiChatResponseDto
                {
                    Success = false,
                    Error = "No response content from model",
                    Reply = "عذراً، لم أتمكن من الحصول على رد متكامل. يرجى إعادة طرح السؤال."
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception while calling OpenRouter API with model {Model}", model);
                return new AiChatResponseDto
                {
                    Success = false,
                    Error = ex.Message,
                    Reply = "حدث خطأ أثناء معالجة السؤال، يرجى المحاولة بعد لحظات."
                };
            }
        }

        private static string CleanOutput(string input)
        {
            if (string.IsNullOrWhiteSpace(input)) return string.Empty;

            var text = input;

            // Remove any CJK (Chinese, Japanese, Korean) characters if any slipped through
            text = Regex.Replace(text, @"[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]", "");

            // Remove common emojis
            text = Regex.Replace(text, @"\p{Cs}|\p{So}|\p{Sk}", "");

            // Clean up leading ### or ## into clean bold headers
            text = Regex.Replace(text, @"^#{2,4}\s*(.*)$", "**$1**", RegexOptions.Multiline);

            return text.Trim();
        }
    }
}
