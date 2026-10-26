using System.Net;
using System.Net.Mail;
using DialectExchange.Core.Interfaces;
using Microsoft.Extensions.Configuration;

namespace DialectExchange.Infrastructure.Services
{
    public sealed class SmtpEmailSender : IEmailSender
    {
        private readonly IConfiguration _configuration;

        public SmtpEmailSender(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public async Task SendAsync(string recipient, string subject, string htmlBody, CancellationToken cancellationToken = default)
        {
            var section = _configuration.GetSection("Email");
            var host = section["SmtpHost"] ?? throw new InvalidOperationException("Email SMTP host is not configured.");
            var port = section.GetValue<int?>("SmtpPort") ?? 587;
            var username = section["Username"] ?? throw new InvalidOperationException("Email username is not configured.");
            var password = section["Password"] ?? throw new InvalidOperationException("Email password is not configured.");
            var fromAddress = section["FromAddress"] ?? username;

            using var message = new MailMessage(fromAddress, recipient, subject, htmlBody) { IsBodyHtml = true };
            using var client = new SmtpClient(host, port)
            {
                EnableSsl = true,
                Credentials = new NetworkCredential(username, password)
            };

            cancellationToken.ThrowIfCancellationRequested();
            await client.SendMailAsync(message, cancellationToken);
        }
    }
}