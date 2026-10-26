using DialectExchange.API.Hubs;
using DialectExchange.Core.DTOs;
using DialectExchange.Core.Entities;
using DialectExchange.Core.Interfaces;
using DialectExchange.Infrastructure.Data;
using DialectExchange.API.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace DialectExchange.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ExchangesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ICloudinaryService _cloudinary;
        private readonly IHubContext<ChatHub> _hub;
        private readonly ILogger<ExchangesController> _logger;

        private const long MaxExchangeFileSize = 100 * 1024 * 1024; // 100 MB for media file
        private const long MaxThumbnailFileSize = 10 * 1024 * 1024;  // 10 MB for thumbnail
        private const long MaxExchangeRequestSize = 120 * 1024 * 1024; // 120 MB request limit (100MB media + 10MB thumbnail + multipart overhead)

        public ExchangesController(
            AppDbContext context,
            ICloudinaryService cloudinary,
            IHubContext<ChatHub> hub,
            ILogger<ExchangesController> logger)
        {
            _context = context;
            _cloudinary = cloudinary;
            _hub = hub;
            _logger = logger;
        }

        // ── Upload ────────────────────────────────────────────
        [HttpPost("upload")]
        [EnableRateLimiting("UploadPolicy")]
        [RequestSizeLimit(MaxExchangeRequestSize)]
        public async Task<IActionResult> UploadExchange([FromForm] ExchangeUploadDto dto)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized(new { message = "User ID not found in token." });
            if (dto.File == null || dto.File.Length == 0) return BadRequest(new { message = "الملف الصوتي أو المرئي مطلوب." });

            var isVideo = dto.MediaType?.ToLowerInvariant() == "video";
            var validation = isVideo
                ? FileSecurityValidator.ValidateVideo(dto.File, MaxExchangeFileSize)
                : FileSecurityValidator.ValidateAudio(dto.File, MaxExchangeFileSize);

            if (!validation.IsValid)
                return BadRequest(new { message = validation.ErrorMessage });

            if (dto.ThumbnailFile != null && dto.ThumbnailFile.Length > 0)
            {
                var thumbValidation = FileSecurityValidator.ValidateImage(dto.ThumbnailFile, MaxThumbnailFileSize);
                if (!thumbValidation.IsValid)
                    return BadRequest(new { message = thumbValidation.ErrorMessage });
            }

            try
            {
                string mediaUrl = isVideo
                    ? await _cloudinary.UploadVideoAsync(dto.File)
                    : await _cloudinary.UploadAudioAsync(dto.File);

                if (string.IsNullOrEmpty(mediaUrl))
                    return BadRequest(new { message = "فشل في رفع ملف الوسائط إلى السحابة." });

                string? thumbnail = null;
                if (dto.ThumbnailFile != null && dto.ThumbnailFile.Length > 0)
                {
                    thumbnail = await _cloudinary.UploadImageAsync(dto.ThumbnailFile);
                }
                else if (isVideo && !string.IsNullOrEmpty(mediaUrl))
                {
                    // Cloudinary video thumbnail auto-generation
                    thumbnail = mediaUrl.EndsWith(".mp4", StringComparison.OrdinalIgnoreCase) ||
                                mediaUrl.EndsWith(".webm", StringComparison.OrdinalIgnoreCase) ||
                                mediaUrl.EndsWith(".mov", StringComparison.OrdinalIgnoreCase)
                        ? Path.ChangeExtension(mediaUrl, ".jpg")
                        : mediaUrl + ".jpg";
                }

                var exchange = new Exchange
                {
                    UploaderId = userId,
                    Title = dto.Title,
                    Description = dto.Description,
                    DialectId = dto.DialectId,
                    MediaType = dto.MediaType ?? "video",
                    MediaUrl = mediaUrl,
                    Thumbnail = thumbnail,
                    CreatedAt = DateTime.UtcNow,
                    Tags = dto.Tags?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList() ?? new List<string>()
                };

                _context.Exchanges.Add(exchange);
                await _context.SaveChangesAsync();
                return Ok(exchange);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading exchange media for user {UserId}", userId);
                return StatusCode(500, new { message = "حدث خطأ أثناء معالجة ورفع المحتوى. يرجى المحاولة لاحقاً." });
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateExchange(Guid id, [FromBody] UpdateExchangeDto dto)
        {
            var userId = GetUserId();
            var exchange = await _context.Exchanges.FirstOrDefaultAsync(x => x.Id == id && x.UploaderId == userId);
            if (exchange == null) return NotFound();
            if (string.IsNullOrWhiteSpace(dto.Title)) return BadRequest(new { message = "Title is required." });
            exchange.Title = dto.Title.Trim();
            exchange.Description = dto.Description?.Trim();
            await _context.SaveChangesAsync();
            return Ok(new { message = "Exchange updated." });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteExchange(Guid id)
        {
            var userId = GetUserId();
            var exchange = await _context.Exchanges.FirstOrDefaultAsync(x => x.Id == id && x.UploaderId == userId);
            if (exchange == null) return NotFound();
            _context.Exchanges.Remove(exchange);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // ── ★ Like (with real-time notification) ──────────────
        [HttpPost("{id}/like")]
        public async Task<IActionResult> LikeExchange(Guid id)
        {
            var actorId = GetUserId();
            if (string.IsNullOrEmpty(actorId))
                return Unauthorized(new { message = "يجب تسجيل الدخول للإعجاب بالمقطع" });

            var exchange = await _context.Exchanges
                .Include(e => e.Uploader)
                .FirstOrDefaultAsync(e => e.Id == id);

            if (exchange == null) return NotFound();

            var existingLike = await _context.ExchangeLikes
                .FirstOrDefaultAsync(l => l.ExchangeId == id && l.UserId == actorId);

            bool isLiked;
            if (existingLike != null)
            {
                // Toggle OFF: Remove existing like
                _context.ExchangeLikes.Remove(existingLike);
                isLiked = false;
            }
            else
            {
                // Toggle ON: Add new like
                var newLike = new ExchangeLike
                {
                    ExchangeId = id,
                    UserId = actorId,
                    CreatedAt = DateTime.UtcNow
                };
                _context.ExchangeLikes.Add(newLike);
                isLiked = true;

                // Push real-time notification to the uploader (if they're online and it's not self-like)
                if (exchange.UploaderId != actorId)
                {
                    var actor = await _context.Users.FindAsync(actorId);
                    var actorName = actor?.DisplayNameAr ?? "أحدهم";

                    await ChatHub.NotifyUser(
                        _hub,
                        targetUserId: exchange.UploaderId,
                        type: "like",
                        title: "إعجاب جديد ❤️",
                        body: $"أعجب {actorName} بمقطعك \"{exchange.Title}\"",
                        icon: "favorite",
                        fromUser: actorName,
                        targetId: exchange.Id.ToString()
                    );
                }
            }

            await _context.SaveChangesAsync();

            // Always calculate accurate count of unique likes from ExchangeLikes
            var count = await _context.ExchangeLikes.CountAsync(l => l.ExchangeId == id);
            exchange.LikeCount = count;
            await _context.SaveChangesAsync();

            return Ok(new { likes = count, isLiked });
        }

        // ── Get comments ──────────────────────────────────────
        [HttpGet("{id}/comments")]
        [AllowAnonymous]
        public async Task<IActionResult> GetComments(Guid id)
        {
            var comments = await _context.Comments
                .Where(c => c.ExchangeId == id)
                .Include(c => c.Author)
                .OrderByDescending(c => c.CreatedAt)
                .Select(c => new {
                    id = c.Id,
                    content = c.Content,
                    author = c.Author != null ? c.Author.DisplayNameAr : "مجهول",
                    createdAt = c.CreatedAt
                })
                .ToListAsync();

            return Ok(comments);
        }

        // ── ★ Add comment (with real-time notification) ────────
        [HttpPost("{id}/comments")]
        public async Task<IActionResult> AddComment(Guid id, [FromBody] AddCommentDto dto)
        {
            var userId = GetUserId();
            if (userId == null) return Unauthorized();
            if (string.IsNullOrWhiteSpace(dto.Content)) return BadRequest("Comment cannot be empty");

            var exchange = await _context.Exchanges
                .Include(e => e.Uploader)
                .FirstOrDefaultAsync(e => e.Id == id);

            if (exchange == null) return NotFound();

            var comment = new Comment
            {
                Content = dto.Content,
                AuthorId = userId,
                ExchangeId = id,
                CreatedAt = DateTime.UtcNow
            };

            _context.Comments.Add(comment);
            await _context.SaveChangesAsync();
            await _context.Entry(comment).Reference(c => c.Author).LoadAsync();

            // Push real-time notification to the uploader (skip self-comment)
            if (exchange.UploaderId != userId)
            {
                var authorName = comment.Author?.DisplayNameAr ?? "أحدهم";
                var preview = dto.Content.Length > 40
                    ? dto.Content[..40] + "..."
                    : dto.Content;

                await ChatHub.NotifyUser(
                    _hub,
                    targetUserId: exchange.UploaderId,
                    type: "comment",
                    title: "تعليق جديد 💬",
                    body: $"علّق {authorName} على \"{exchange.Title}\": {preview}",
                    icon: "chat_bubble",
                    fromUser: authorName,
                    targetId: exchange.Id.ToString()
                );
            }

            return Ok(new {
                id = comment.Id,
                content = comment.Content,
                author = comment.Author?.DisplayNameAr ?? "مجهول",
                createdAt = comment.CreatedAt
            });
        }

         // ── Get all exchanges ─────────────────────────────────
        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> GetAllExchanges()
        {
            var currentUserId = GetUserId();

            var exchanges = await _context.Exchanges
                .Include(x => x.Uploader)
                .Include(x => x.Dialect)
                .OrderByDescending(x => x.CreatedAt)
                .Select(x => new {
                    id = x.Id,
                    userId = x.UploaderId,
                    title = x.Title,
                    description = x.Description,
                    mediaUrl = x.MediaUrl,
                    thumbnail = (x.Thumbnail != null && x.Thumbnail.Contains("photo-1544717305-2782549b5136")) ? null : x.Thumbnail,
                    type = x.MediaType,
                    dialectId = x.DialectId,
                    user = x.Uploader != null ? x.Uploader.DisplayNameAr : "مجهول",
                    profileImage = x.Uploader != null ? x.Uploader.ProfileImageUrl : null,
                    dialect = x.Dialect != null ? x.Dialect.NameAr : "عامة",
                    flag = x.Dialect != null ? x.Dialect.FlagEmoji : "🌐",
                    likes = _context.ExchangeLikes.Count(l => l.ExchangeId == x.Id),
                    isLiked = !string.IsNullOrEmpty(currentUserId) && _context.ExchangeLikes.Any(l => l.ExchangeId == x.Id && l.UserId == currentUserId),
                    commentCount = x.Comments.Count,
                    createdAt = x.CreatedAt
                })
                .ToListAsync();

            return Ok(exchanges);
        }
        private string? GetUserId() =>
            User.FindFirstValue(ClaimTypes.NameIdentifier) ??
            User.FindFirstValue("id") ??
            User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);
    }

    public class UpdateExchangeDto
    {
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
    }
}