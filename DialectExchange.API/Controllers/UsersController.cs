using DialectExchange.Infrastructure.Data;
using DialectExchange.Core.Entities;
using DialectExchange.API.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using DialectExchange.Core.Interfaces;
using System.Security.Claims;

namespace DialectExchange.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class UsersController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly UserManager<AppUser> _userManager;

        public UsersController(AppDbContext context, UserManager<AppUser> userManager)
        {
            _context = context;
            _userManager = userManager;
        }

        // GET api/users/profile — current logged-in user's profile
        [HttpGet("profile")]
        public async Task<IActionResult> GetMyProfile()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ??
                         User.FindFirstValue("id") ??
                         User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);

            if (userId == null) return Unauthorized();

            var user = await _context.Users
                .Include(u => u.NativeDialect)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null) return NotFound();

            var exchanges = await _context.Exchanges
                .Where(e => e.UploaderId == userId)
                .Include(e => e.Dialect)
                .OrderByDescending(e => e.CreatedAt)
                .Select(e => new {
                    id = e.Id,
                    userId = e.UploaderId,
                    title = e.Title,
                    description = e.Description,
                    mediaUrl = e.MediaUrl,
                    thumbnail = e.Thumbnail,
                    type = e.MediaType,
                    dialectId = e.DialectId,
                    dialect = e.Dialect != null ? e.Dialect.NameAr : "عامة",
                    flag = e.Dialect != null ? e.Dialect.FlagEmoji : "🌐",
                    likes = e.LikeCount,
                    commentCount = e.Comments.Count,
                    createdAt = e.CreatedAt
                })
                .ToListAsync();

            return Ok(new {
                id = user.Id,
                displayName = user.DisplayNameAr,
                email = user.Email,
                country = user.Country,
                bioAr = user.BioAr,
                profileImage = user.ProfileImageUrl,
                coverImage = user.CoverImageUrl,
                nativeDialect = user.NativeDialect != null ? new {
                    id = user.NativeDialect.Id.ToString(),
                    name = user.NativeDialect.NameAr,
                    flag = user.NativeDialect.FlagEmoji
                } : null,
                joinedAt = user.CreatedAt,
                learningDialects = await _context.Dialects
                    .Where(d => user.LearningDialects.Contains(d.Id))
                    .Select(d => new { id = d.Id.ToString(), name = d.NameAr, flag = d.FlagEmoji })
                    .ToListAsync(),
                exchangeCount = exchanges.Count,
                totalLikes = exchanges.Sum(e => e.likes),
                exchanges
            });
        }

        // PUT api/users/profile — update bio/country
        [HttpPut("profile")]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDto dto)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ??
                         User.FindFirstValue("id") ??
                         User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);

            if (userId == null) return Unauthorized();

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();

            if (dto.BioAr != null) user.BioAr = dto.BioAr;
            if (dto.Country != null) user.Country = dto.Country;
            if (dto.DisplayName != null) user.DisplayNameAr = dto.DisplayName;

            if (!string.IsNullOrWhiteSpace(dto.NativeDialectId))
            {
                if (Guid.TryParse(dto.NativeDialectId, out var parsedNativeId))
                {
                    user.NativeDialectId = parsedNativeId;
                }
            }

            if (dto.LearningDialectIds != null)
            {
                user.LearningDialects = dto.LearningDialectIds
                    .Where(id => !string.IsNullOrWhiteSpace(id) && Guid.TryParse(id, out _))
                    .Select(Guid.Parse)
                    .ToList();
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "تم تحديث الملف الشخصي بنجاح" });
        }

        private const long MaxUserImageSize = 10 * 1024 * 1024; // 10 MB

        [HttpPost("profile/image")]
        [EnableRateLimiting("UploadPolicy")]
        [RequestSizeLimit(MaxUserImageSize)]
        public async Task<IActionResult> UploadProfileImage(IFormFile file, [FromServices] ICloudinaryService cloudinary)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("id") ?? User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);
            if (userId == null) return Unauthorized();

            var validation = FileSecurityValidator.ValidateImage(file, MaxUserImageSize);
            if (!validation.IsValid) return BadRequest(new { message = validation.ErrorMessage });

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();
            var url = await cloudinary.UploadImageAsync(file);
            if (string.IsNullOrEmpty(url)) return BadRequest(new { message = "فشل في رفع الصورة الشخصية." });
            user.ProfileImageUrl = url;
            await _context.SaveChangesAsync();
            return Ok(new { profileImage = url });
        }

        [HttpDelete("profile/image")]
        public async Task<IActionResult> DeleteProfileImage()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("id") ?? User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);
            if (userId == null) return Unauthorized();
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();
            user.ProfileImageUrl = null;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpPost("profile/cover")]
        [EnableRateLimiting("UploadPolicy")]
        [RequestSizeLimit(MaxUserImageSize)]
        public async Task<IActionResult> UploadCoverImage(IFormFile file, [FromServices] ICloudinaryService cloudinary)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("id") ?? User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);
            if (userId == null) return Unauthorized();

            var validation = FileSecurityValidator.ValidateImage(file, MaxUserImageSize);
            if (!validation.IsValid) return BadRequest(new { message = validation.ErrorMessage });

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();
            var url = await cloudinary.UploadImageAsync(file);
            if (string.IsNullOrEmpty(url)) return BadRequest(new { message = "فشل في رفع صورة الغلاف." });
            user.CoverImageUrl = url;
            await _context.SaveChangesAsync();
            return Ok(new { coverImage = url });
        }

        [HttpDelete("profile/cover")]
        public async Task<IActionResult> DeleteCoverImage()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("id") ?? User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);
            if (userId == null) return Unauthorized();
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();
            user.CoverImageUrl = null;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete]
        public async Task<IActionResult> DeleteAccount()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("id") ?? User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);
            if (userId == null) return Unauthorized();

            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return NotFound();

            await using var transaction = await _context.Database.BeginTransactionAsync();
            var exchangeIds = await _context.Exchanges
                .Where(e => e.UploaderId == userId)
                .Select(e => e.Id)
                .ToListAsync();

            _context.Messages.RemoveRange(await _context.Messages
                .Where(m => m.SenderId == userId || m.ReceiverId == userId)
                .ToListAsync());
            _context.Comments.RemoveRange(await _context.Comments
                .Where(c => c.AuthorId == userId)
                .ToListAsync());
            _context.Transcripts.RemoveRange(await _context.Transcripts
                .Where(t => exchangeIds.Contains(t.ExchangeId))
                .ToListAsync());
            _context.Exchanges.RemoveRange(await _context.Exchanges
                .Where(e => exchangeIds.Contains(e.Id))
                .ToListAsync());

            await _context.SaveChangesAsync();
            var result = await _userManager.DeleteAsync(user);
            if (!result.Succeeded)
            {
                await transaction.RollbackAsync();
                return BadRequest(new { message = "تعذر حذف الحساب." });
            }

            await transaction.CommitAsync();
            return NoContent();
        }
    }

    public class UpdateProfileDto
    {
        public string? DisplayName { get; set; }
        public string? BioAr { get; set; }
        public string? Country { get; set; }
        public string? NativeDialectId { get; set; }
        public List<string>? LearningDialectIds { get; set; }
    }
}