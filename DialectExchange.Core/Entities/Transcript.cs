namespace DialectExchange.Core.Entities
{
    public class Transcript
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid ExchangeId { get; set; }
        public List<TranscriptWord> Words { get; set; } = new();
    }

    public class TranscriptWord
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid TranscriptId { get; set; }

        public string WordAr { get; set; } = string.Empty; // The dialect word
        public string? WordStandard { get; set; }          // The Fusha (MSA) version
        public string? ExplanationAr { get; set; }         // Cultural explanation

        public double StartTime { get; set; } // Seconds (e.g., 1.5)
        public double EndTime { get; set; }   // Seconds (e.g., 2.3)
    }
}