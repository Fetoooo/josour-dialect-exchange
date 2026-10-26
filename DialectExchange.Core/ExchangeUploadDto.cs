using Microsoft.AspNetCore.Http;
using System.ComponentModel.DataAnnotations;

namespace DialectExchange.Core.DTOs
{
    public class ExchangeUploadDto
    {
        [Required]
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }

        [Required]
        public Guid DialectId { get; set; }

        [Required]
        public string MediaType { get; set; } = "video"; // "video" or "voice_note"

        [Required]
        public IFormFile File { get; set; } = null!; 
        // The = null! tells C# "I promise this will be provided by the form" // The actual video/audio file

        public string? Tags { get; set; } // Comma separated tags

        public IFormFile? ThumbnailFile { get; set; }
    }
}