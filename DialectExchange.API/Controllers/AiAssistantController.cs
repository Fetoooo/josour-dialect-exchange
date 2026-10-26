using System.Security.Claims;
using DialectExchange.Core.DTOs;
using DialectExchange.Core.Entities;
using DialectExchange.Core.Interfaces;
using DialectExchange.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace DialectExchange.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [EnableRateLimiting("AiPolicy")]
    public class AiAssistantController : ControllerBase
    {
        private readonly IAiAssistantService _aiService;
        private readonly AppDbContext _context;
        private readonly UserManager<AppUser> _userManager;
        private readonly ILogger<AiAssistantController> _logger;

        public AiAssistantController(
            IAiAssistantService aiService,
            AppDbContext context,
            UserManager<AppUser> userManager,
            ILogger<AiAssistantController> logger)
        {
            _aiService = aiService;
            _context = context;
            _userManager = userManager;
            _logger = logger;
        }

        [HttpPost("chat")]
        [RequestSizeLimit(131_072)] // 128 KB max for text AI chat requests
        public async Task<IActionResult> Chat([FromBody] AiChatRequestDto request)
        {
            if (request == null || request.Messages == null || !request.Messages.Any() || request.Messages.All(m => string.IsNullOrWhiteSpace(m.Content)))
            {
                return BadRequest(new AiChatResponseDto
                {
                    Success = false,
                    Error = "قائمة الرسائل فارغة أو تحتوي على نصوص فارغة.",
                    Reply = "يرجى كتابة رسالة للبدء."
                });
            }

            if (request.Messages.Count > 20)
            {
                return BadRequest(new AiChatResponseDto
                {
                    Success = false,
                    Error = "تجاوزت الحد الأقصى لعدد الرسائل في المحادثة (20 رسالة).",
                    Reply = "يرجى بدء محادثة جديدة لتفادي تجاوز الحد المسموح."
                });
            }

            if (request.Messages.Any(m => m.Content != null && m.Content.Length > 4000))
            {
                return BadRequest(new AiChatResponseDto
                {
                    Success = false,
                    Error = "تتجاوز إحدى الرسائل الحد الأقصى المسموح به (4000 حرف).",
                    Reply = "يرجى اختصار رسالتك والمحاولة مرة أخرى."
                });
            }

            // Optional: enrich with user context if authenticated
            string? userContext = null;
            try
            {
                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ??
                             User.FindFirstValue("id") ??
                             User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);

                if (!string.IsNullOrEmpty(userId))
                {
                    var user = await _context.Users
                        .Include(u => u.NativeDialect)
                        .FirstOrDefaultAsync(u => u.Id == userId);

                    if (user != null)
                    {
                        var name = string.IsNullOrWhiteSpace(user.DisplayNameAr) ? user.UserName : user.DisplayNameAr;
                        var nativeDialect = user.NativeDialect?.NameAr ?? user.NativeDialect?.NameEn;
                        userContext = $"اسم المستخدم: {name}";
                        if (!string.IsNullOrWhiteSpace(nativeDialect))
                        {
                            userContext += $"\nلهجته الأم: {nativeDialect}";
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not fetch authenticated user details for AI context.");
            }

            if (!string.IsNullOrWhiteSpace(request.CurrentPage))
            {
                userContext = (userContext != null ? userContext + "\n" : "") + $"الصفحة الحالية في المنصة: {request.CurrentPage}";
            }

            var result = await _aiService.GetChatResponseAsync(request.Messages, userContext);
            return Ok(result);
        }
    }
}
