using DialectExchange.Core.Interfaces;
using DialectExchange.Infrastructure.Data;
using DialectExchange.API.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace DialectExchange.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class MessagesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly ICloudinaryService _cloudinary;
        private readonly ILogger<MessagesController> _logger;

        private const long MaxMessageFileSize = 50 * 1024 * 1024; // 50 MB

        public MessagesController(
            AppDbContext context,
            ICloudinaryService cloudinary,
            ILogger<MessagesController> logger)
        {
            _context = context;
            _cloudinary = cloudinary;
            _logger = logger;
        }

        // POST api/messages/upload — upload image/video/voice/file to Cloudinary
        [HttpPost("upload")]
        [EnableRateLimiting("UploadPolicy")]
        [RequestSizeLimit(MaxMessageFileSize)]
        public async Task<IActionResult> UploadFile(IFormFile file, [FromQuery] string? type = null)
        {
            var baseValidation = FileSecurityValidator.ValidateMessageAttachment(file, MaxMessageFileSize);
            if (!baseValidation.IsValid)
                return BadRequest(new { message = baseValidation.ErrorMessage });

            var ext = Path.GetExtension(file.FileName)?.ToLowerInvariant() ?? "";

            // Auto-detect type if not explicitly passed or generic file
            var detectedType = type?.ToLowerInvariant();
            if (string.IsNullOrEmpty(detectedType) || detectedType == "file")
            {
                var contentType = file.ContentType?.ToLowerInvariant() ?? "";
                if (contentType.StartsWith("image/") || ext is ".jpg" or ".jpeg" or ".png" or ".gif" or ".webp" or ".bmp" or ".svg")
                    detectedType = "image";
                else if (contentType.StartsWith("video/") || ext is ".mp4" or ".mov" or ".webm" or ".mkv" or ".avi" or ".3gp")
                    detectedType = "video";
                else if (contentType.StartsWith("audio/") || ext is ".mp3" or ".wav" or ".ogg" or ".m4a" or ".aac" or ".weba")
                    detectedType = "voice";
                else
                    detectedType = "file";
            }

            // Perform deep magic byte validation depending on detected media type
            if (detectedType == "image" && ext is not ".svg")
            {
                var imgVal = FileSecurityValidator.ValidateImage(file, MaxMessageFileSize);
                if (!imgVal.IsValid) return BadRequest(new { message = imgVal.ErrorMessage });
            }
            else if (detectedType == "video")
            {
                var vidVal = FileSecurityValidator.ValidateVideo(file, MaxMessageFileSize);
                if (!vidVal.IsValid) return BadRequest(new { message = vidVal.ErrorMessage });
            }
            else if (detectedType is "voice" or "audio")
            {
                var audVal = FileSecurityValidator.ValidateAudio(file, MaxMessageFileSize);
                if (!audVal.IsValid) return BadRequest(new { message = audVal.ErrorMessage });
            }

            try
            {
                string url;
                if (detectedType == "image")
                    url = await _cloudinary.UploadImageAsync(file);
                else if (detectedType == "video")
                    url = await _cloudinary.UploadVideoAsync(file);
                else if (detectedType is "voice" or "audio")
                    url = await _cloudinary.UploadAudioAsync(file);
                else
                    url = await _cloudinary.UploadFileAsync(file);

                if (string.IsNullOrEmpty(url))
                    return BadRequest(new { message = "فشل في رفع الملف إلى السحابة." });

                return Ok(new
                {
                    url,
                    fileName = file.FileName,
                    fileSize = file.Length,
                    type = detectedType
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading message attachment {FileName}", file.FileName);
                return StatusCode(500, new { message = "حدث خطأ أثناء رفع الملف. يرجى المحاولة لاحقاً." });
            }
        }

        // GET api/messages/history/{otherUserId}
        [HttpGet("history/{otherUserId}")]
        public async Task<IActionResult> GetHistory(string otherUserId)
        {
            var myId = GetUserId();
            if (myId == null) return Unauthorized();

            var messages = await _context.Messages
                .Where(m =>
                    (m.SenderId == myId && m.ReceiverId == otherUserId) ||
                    (m.SenderId == otherUserId && m.ReceiverId == myId))
                .OrderBy(m => m.SentAt)
                .Include(m => m.Sender)
                .Select(m => new {
                    id = m.Id,
                    messageType = m.MessageType,
                    senderId = m.SenderId,
                    senderName = m.Sender != null ? m.Sender.DisplayNameAr : "مجهول",
                    receiverId = m.ReceiverId,
                    content = m.IsDeleted ? "تم حذف هذه الرسالة" : m.Content,
                    fileUrl = m.FileUrl,
                    fileName = m.FileName,
                    fileSize = m.FileSize,
                    sentAt = m.SentAt,
                    isRead = m.IsRead,
                    isDeleted = m.IsDeleted,
                    isEdited = m.IsEdited,
                    editedAt = m.EditedAt,
                    canEdit = !m.IsDeleted && m.SenderId == myId && (DateTime.UtcNow - m.SentAt).TotalMinutes <= 5,
                    canDelete = !m.IsDeleted && m.SenderId == myId && (DateTime.UtcNow - m.SentAt).TotalMinutes <= 5
                })
                .ToListAsync();

            var unread = await _context.Messages
                .Where(m => m.SenderId == otherUserId && m.ReceiverId == myId && !m.IsRead)
                .ToListAsync();
            unread.ForEach(m => m.IsRead = true);
            await _context.SaveChangesAsync();

            return Ok(messages);
        }

        // GET api/messages/conversations
        [HttpGet("conversations")]
        public async Task<IActionResult> GetConversations()
        {
            var myId = GetUserId();
            if (myId == null) return Unauthorized();

            var partnerIds = await _context.Messages
                .Where(m => m.SenderId == myId || m.ReceiverId == myId)
                .Select(m => m.SenderId == myId ? m.ReceiverId : m.SenderId)
                .Distinct()
                .ToListAsync();

            var conversations = new List<object>();

            foreach (var partnerId in partnerIds)
            {
                var partner = await _context.Users.FindAsync(partnerId);
                if (partner == null) continue;

                var lastMessage = await _context.Messages
                    .Where(m =>
                        (m.SenderId == myId && m.ReceiverId == partnerId) ||
                        (m.SenderId == partnerId && m.ReceiverId == myId))
                    .OrderByDescending(m => m.SentAt)
                    .FirstOrDefaultAsync();

                var unreadCount = await _context.Messages
                    .CountAsync(m => m.SenderId == partnerId && m.ReceiverId == myId && !m.IsRead);

                var lastPreview = lastMessage == null ? "" :
                    lastMessage.IsDeleted ? "تم حذف رسالة" :
                    lastMessage.MessageType == "image" ? "📷 صورة" :
                    lastMessage.MessageType == "video" ? "📹 مقطع فيديو" :
                    lastMessage.MessageType == "voice" ? "🎙 رسالة صوتية" :
                    lastMessage.MessageType == "file" ? $"📎 {lastMessage.FileName}" :
                    lastMessage.Content;

                conversations.Add(new {
                    userId = partner.Id,
                    displayName = partner.DisplayNameAr,
                    profileImage = partner.ProfileImageUrl,
                    lastMessage = lastPreview,
                    lastMessageAt = lastMessage?.SentAt,
                    unreadCount
                });
            }

            return Ok(conversations.OrderByDescending(c => ((dynamic)c).lastMessageAt));
        }

        // GET api/messages/users
        [HttpGet("users")]
        public async Task<IActionResult> GetAllUsers()
        {
            var myId = GetUserId();
            var users = await _context.Users
                .Where(u => u.Id != myId)
                .Select(u => new { id = u.Id, displayName = u.DisplayNameAr, profileImage = u.ProfileImageUrl })
                .ToListAsync();
            return Ok(users);
        }

        private string? GetUserId() =>
            User.FindFirstValue(ClaimTypes.NameIdentifier) ??
            User.FindFirstValue("id") ??
            User.FindFirstValue("sub");
    }
}