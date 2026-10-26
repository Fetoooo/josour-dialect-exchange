namespace DialectExchange.Core.Entities
{
    public class Dialect
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string NameAr { get; set; } = string.Empty;
        public string NameEn { get; set; } = string.Empty;
        public string Country { get; set; } = string.Empty;
        public string? Region { get; set; }
        public string FlagEmoji { get; set; } = string.Empty;
        public string? Description { get; set; }
        public bool IsActive { get; set; } = true;
    }
}