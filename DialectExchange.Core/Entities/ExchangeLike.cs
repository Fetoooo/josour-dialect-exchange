using System;

namespace DialectExchange.Core.Entities
{
    public class ExchangeLike
    {
        public Guid Id { get; set; } = Guid.NewGuid();

        public Guid ExchangeId { get; set; }
        public Exchange? Exchange { get; set; }

        public string UserId { get; set; } = string.Empty;
        public AppUser? User { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
