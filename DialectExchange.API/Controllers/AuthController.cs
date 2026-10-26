using DialectExchange.Core.DTOs;
using DialectExchange.Core.Entities;
using DialectExchange.Core.Interfaces;
using DialectExchange.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace DialectExchange.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [EnableRateLimiting("AuthPolicy")]
    public class AuthController : ControllerBase
    {
        private readonly UserManager<AppUser> _userManager;
        private readonly ITokenService _tokenService;
        private readonly IEmailSender _emailSender;
        private readonly IConfiguration _configuration;
        private readonly AppDbContext _context;
        private readonly ILogger<AuthController> _logger;

        public AuthController(
            UserManager<AppUser> userManager, 
            ITokenService tokenService, 
            IEmailSender emailSender, 
            IConfiguration configuration,
            AppDbContext context,
            ILogger<AuthController> logger)
        {
            _userManager = userManager;
            _tokenService = tokenService;
            _emailSender = emailSender;
            _configuration = configuration;
            _context = context;
            _logger = logger;
        }

        [HttpPost("login")]
        public async Task<ActionResult<UserDto>> Login([FromBody] LoginDto loginDto)
        {
            if (loginDto == null || string.IsNullOrEmpty(loginDto.Email))
                return BadRequest(new { message = "Email is required" });

            var user = await _userManager.FindByEmailAsync(loginDto.Email);
            if (user == null) return Unauthorized(new { message = "Invalid email" });

            var result = await _userManager.CheckPasswordAsync(user, loginDto.Password);
            if (!result) return Unauthorized(new { message = "Invalid password" });
            if (!user.EmailConfirmed)
                return StatusCode(403, new { message = "يرجى تأكيد بريدك الإلكتروني قبل تسجيل الدخول." });

            var expiryHours = int.TryParse(_configuration["Jwt:ExpiryHours"], out var h) ? h : 2;

            return Ok(new UserDto
            {
                Id = user.Id,
                Email = user.Email!,
                DisplayName = user.DisplayNameAr ?? user.UserName ?? "مستخدم",
                Token = _tokenService.CreateToken(user),
                ExpiresAt = DateTime.UtcNow.AddHours(expiryHours),
                ProfileImage = user.ProfileImageUrl,
                CoverImage = user.CoverImageUrl
            });
        }

        [HttpPost("register")]
        public async Task<ActionResult<UserDto>> Register([FromBody] RegisterDto registerDto)
        {
            var email = registerDto.Email.Trim();
            if (await _userManager.FindByEmailAsync(email) != null)
                return Conflict(new { message = "هذا البريد الإلكتروني مستخدم بالفعل." });

            if (registerDto.NativeDialectId != Guid.Empty &&
                !await _context.Dialects.AnyAsync(d => d.Id == registerDto.NativeDialectId))
            {
                return BadRequest(new { message = "اللهجة الأم المحددة غير صالحة أو غير متوفرة." });
            }

            if (registerDto.LearningDialectId != Guid.Empty &&
                !await _context.Dialects.AnyAsync(d => d.Id == registerDto.LearningDialectId))
            {
                return BadRequest(new { message = "اللهجة المراد تعلمها غير صالحة أو غير متوفرة." });
            }

            var user = new AppUser
            {
                DisplayNameAr = registerDto.DisplayName,
                Email = email,
                UserName = email,
                NativeDialectId = registerDto.NativeDialectId != Guid.Empty ? registerDto.NativeDialectId : null,
                LearningDialects = registerDto.LearningDialectId != Guid.Empty 
                    ? new List<Guid> { registerDto.LearningDialectId } 
                    : new List<Guid>()
            };

            IdentityResult result;
            try
            {
                result = await _userManager.CreateAsync(user, registerDto.Password);
            }
            catch (DbUpdateException ex)
            {
                _logger.LogError(ex, "DbUpdateException occurred during registration for email {Email}", email);
                var innerMsg = ex.InnerException?.Message ?? string.Empty;
                if (innerMsg.Contains("IX_AspNetUsers_NormalizedEmail", StringComparison.OrdinalIgnoreCase) ||
                    innerMsg.Contains("IX_AspNetUsers_NormalizedUserName", StringComparison.OrdinalIgnoreCase) ||
                    innerMsg.Contains("duplicate key", StringComparison.OrdinalIgnoreCase) ||
                    innerMsg.Contains("23505"))
                {
                    return Conflict(new { message = "هذا البريد الإلكتروني مستخدم بالفعل." });
                }

                return BadRequest(new { message = "تعذر إكمال التسجيل، يرجى التأكد من صحة البيانات المدخلة والمحاولة مجدداً." });
            }

            if (!result.Succeeded)
            {
                if (result.Errors.Any(error => error.Code.StartsWith("Duplicate", StringComparison.OrdinalIgnoreCase)))
                    return Conflict(new { message = "هذا البريد الإلكتروني مستخدم بالفعل." });

                return BadRequest(result.Errors);
            }

            try
            {
                var token = await _userManager.GenerateEmailConfirmationTokenAsync(user);
                var frontendUrl = _configuration["FrontendBaseUrl"] ?? "http://localhost:4200";
                var confirmationUrl = $"{frontendUrl.TrimEnd('/')}/verify-email?userId={Uri.EscapeDataString(user.Id)}&token={Uri.EscapeDataString(token)}";
                await _emailSender.SendAsync(user.Email!, "تأكيد بريدك الإلكتروني في جُسور", BuildConfirmationEmail(user.DisplayNameAr, confirmationUrl));
            }
            catch
            {
                await _userManager.DeleteAsync(user);
                return StatusCode(503, new { message = "تعذر إرسال رسالة التحقق. حاول مرة أخرى لاحقا." });
            }

            return Ok(new { message = "تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتفعيله." });
        }

        [HttpPost("confirm-email")]
        public async Task<IActionResult> ConfirmEmail([FromBody] ConfirmEmailDto dto)
        {
            var user = await _userManager.FindByIdAsync(dto.UserId);
            if (user == null) return BadRequest(new { message = "رابط التحقق غير صالح." });

            var result = await _userManager.ConfirmEmailAsync(user, dto.Token);
            if (!result.Succeeded) return BadRequest(new { message = "رابط التحقق غير صالح أو منتهي الصلاحية." });
            return Ok(new { message = "تم تأكيد بريدك الإلكتروني بنجاح." });
        }

        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto dto)
        {
            const string message = "إذا كان البريد مسجلا لدينا، فستصلك رسالة تحتوي على رابط إعادة تعيين كلمة المرور.";
            var user = await _userManager.FindByEmailAsync(dto.Email.Trim());
            if (user == null || string.IsNullOrWhiteSpace(user.Email)) return Ok(new { message });

            var token = await _userManager.GeneratePasswordResetTokenAsync(user);
            var frontendUrl = _configuration["FrontendBaseUrl"] ?? "http://localhost:4200";
            var resetUrl = $"{frontendUrl.TrimEnd('/')}/reset-password?userId={Uri.EscapeDataString(user.Id)}&token={Uri.EscapeDataString(token)}";
            try
            {
                await _emailSender.SendAsync(user.Email, "إعادة تعيين كلمة المرور في جُسور", BuildResetEmail(user.DisplayNameAr, resetUrl));
            }
            catch
            {
                return StatusCode(503, new { message = "تعذر إرسال الرسالة حاليا. حاول مرة أخرى لاحقا." });
            }

            return Ok(new { message });
        }

        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto dto)
        {
            var user = await _userManager.FindByIdAsync(dto.UserId);
            if (user == null) return BadRequest(new { message = "رابط إعادة التعيين غير صالح." });

            var result = await _userManager.ResetPasswordAsync(user, dto.Token, dto.NewPassword);
            if (!result.Succeeded) return BadRequest(result.Errors);
            return Ok(new { message = "تم تغيير كلمة المرور بنجاح." });
        }

        private static string BuildConfirmationEmail(string displayName, string confirmationUrl) => $"""
            <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#1e293b">
              <h2>مرحبا {System.Net.WebUtility.HtmlEncode(displayName)}،</h2>
              <p>أكد بريدك الإلكتروني لتفعيل حسابك في جُسور والبدء في التعلم.</p>
              <p><a href="{confirmationUrl}" style="display:inline-block;padding:12px 22px;background:#0d9488;color:#fff;text-decoration:none;border-radius:8px">تأكيد البريد الإلكتروني</a></p>
              <p>إذا لم تنشئ هذا الحساب، يمكنك تجاهل هذه الرسالة.</p>
            </div>
            """;

        private static string BuildResetEmail(string displayName, string resetUrl) => $"""
            <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#1e293b">
              <h2>مرحبا {System.Net.WebUtility.HtmlEncode(displayName)}،</h2>
              <p>تلقينا طلبا لإعادة تعيين كلمة المرور لحسابك في جُسور.</p>
              <p><a href="{resetUrl}" style="display:inline-block;padding:12px 22px;background:#0d9488;color:#fff;text-decoration:none;border-radius:8px">إعادة تعيين كلمة المرور</a></p>
              <p>إذا لم تطلب ذلك، تجاهل هذه الرسالة.</p>
            </div>
            """;
        }
}