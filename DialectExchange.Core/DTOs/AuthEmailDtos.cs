using System.ComponentModel.DataAnnotations;

namespace DialectExchange.Core.DTOs
{
    public sealed record ConfirmEmailDto
    {
        [Required]
        public string UserId { get; init; } = string.Empty;

        [Required]
        public string Token { get; init; } = string.Empty;
    }

    public sealed record ForgotPasswordDto
    {
        [Required, EmailAddress]
        public string Email { get; init; } = string.Empty;
    }

    public sealed record ResetPasswordDto
    {
        [Required]
        public string UserId { get; init; } = string.Empty;

        [Required]
        public string Token { get; init; } = string.Empty;

        [Required, MinLength(6)]
        public string NewPassword { get; init; } = string.Empty;
    }
}