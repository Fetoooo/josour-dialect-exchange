namespace DialectExchange.Core.Entities
{
    public class Message
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        // 'text' | 'image' | 'file' | 'voice'
        public string MessageType { get; set; } = "text";
        public string Content { get; set; } = string.Empty;

        // For image/file/voice messages
        public string? FileUrl { get; set; }
        public string? FileName { get; set; }
        public long? FileSize { get; set; }

        public string SenderId { get; set; } = string.Empty;
        public AppUser? Sender { get; set; }

        public string ReceiverId { get; set; } = string.Empty;
        public AppUser? Receiver { get; set; }

        public bool IsRead { get; set; } = false;

        // Delete within 5 min
        public bool IsDeleted { get; set; } = false;
        public DateTime? DeletedAt { get; set; }

        // Edit within 5 min
        public bool IsEdited { get; set; } = false;
        public DateTime? EditedAt { get; set; }

        public DateTime SentAt { get; set; } = DateTime.UtcNow;
    }
}