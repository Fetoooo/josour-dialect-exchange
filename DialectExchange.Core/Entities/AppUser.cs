using Microsoft.AspNetCore.Identity;

namespace DialectExchange.Core.Entities
{
    public class AppUser : IdentityUser
    {
        public string DisplayNameAr { get; set; } = string.Empty;
        public string DisplayNameEn { get; set; } = string.Empty;
        public string? Country { get; set; }
        public string? BioAr { get; set; }
        public string? ProfileImageUrl { get; set; }
        public string? CoverImageUrl { get; set; }
        public bool IsVerified { get; set; } = false;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Foreign Keys
        public Guid? NativeDialectId { get; set; }
        public Dialect? NativeDialect { get; set; }

        // مصفوفة لتخزين معرفات اللهجات التي يتعلمها
        public List<Guid> LearningDialects { get; set; } = new List<Guid>();
    }
}