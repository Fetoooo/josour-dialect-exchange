using System.ComponentModel.DataAnnotations;

namespace DialectExchange.Core.DTOs
{
    public class RegisterDto
    {
        [Required]
        public string DisplayName { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MinLength(6)]
        public string Password { get; set; } = string.Empty;

        // The user must select their native dialect when signing up
        [Required]
        public Guid NativeDialectId { get; set; }

        [Required]
        public Guid LearningDialectId { get; set; }
    }
}