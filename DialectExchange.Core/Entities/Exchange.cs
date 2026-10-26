namespace DialectExchange.Core.Entities
{
    public class Exchange
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string UploaderId { get; set; } = string.Empty;
        public AppUser? Uploader { get; set; }

        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }

        public Guid DialectId { get; set; }
        public Dialect? Dialect { get; set; }

        public string MediaType { get; set; } = string.Empty;
        public string MediaUrl { get; set; } = string.Empty;

        public int Duration { get; set; }
        public string? Thumbnail { get; set; }
        public List<string> Tags { get; set; } = new List<string>();

        public int ViewCount { get; set; } = 0;
        public int LikeCount { get; set; } = 0;
        public bool IsPublic { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation property for comments
        public List<Comment> Comments { get; set; } = new List<Comment>();
    }
}