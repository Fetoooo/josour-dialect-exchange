namespace DialectExchange.Core.DTOs
{
    public class UserDto
    {
        public string Id { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public string Token { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? ProfileImage { get; set; }
        public string? CoverImage { get; set; }
        public DateTime? ExpiresAt { get; set; }
    }
}