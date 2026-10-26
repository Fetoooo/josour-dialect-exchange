namespace DialectExchange.Core.DTOs
{
    public class AiChatMessageDto
    {
        public string Role { get; set; } = "user"; // "user" or "assistant"
        public string Content { get; set; } = string.Empty;
    }

    public class AiChatRequestDto
    {
        public List<AiChatMessageDto> Messages { get; set; } = new();
        public string? CurrentPage { get; set; }
    }

    public class AiChatResponseDto
    {
        public string Reply { get; set; } = string.Empty;
        public bool Success { get; set; } = true;
        public string? Error { get; set; }
    }
}
