namespace DialectExchange.Core.Interfaces
{
    public interface IEmailSender
    {
        Task SendAsync(string recipient, string subject, string htmlBody, CancellationToken cancellationToken = default);
    }
}