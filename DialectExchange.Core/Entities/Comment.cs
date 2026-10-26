namespace DialectExchange.Core.Entities
{
    public class Comment
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Content { get; set; } = string.Empty;

        public string AuthorId { get; set; } = string.Empty;
        public AppUser? Author { get; set; }

        public Guid ExchangeId { get; set; }
        public Exchange? Exchange { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}