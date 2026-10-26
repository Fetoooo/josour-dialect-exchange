using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Cryptography;
using System.Text;

namespace DialectExchange.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CallsController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<CallsController> _logger;

        public CallsController(IConfiguration configuration, ILogger<CallsController> logger)
        {
            _configuration = configuration;
            _logger = logger;
        }

        [HttpGet("ice-servers")]
        public IActionResult GetIceServers()
        {
            var defaultStuns = new object[]
            {
                new { urls = new[] { "stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302" } }
            };

            var turnServer = _configuration["Turn:Server"];
            var turnSecret = _configuration["Turn:Secret"];
            var turnUsername = _configuration["Turn:Username"];
            var turnCredential = _configuration["Turn:Credential"];

            var iceServers = new List<object>(defaultStuns);
            bool hasTurn = false;

            // Scenario 1: Ephemeral coturn / managed TURN credentials generated with shared secret
            if (!string.IsNullOrWhiteSpace(turnServer) && !string.IsNullOrWhiteSpace(turnSecret))
            {
                try
                {
                    var expiryHours = _configuration.GetValue<int>("Turn:TokenExpiryHours", 24);
                    var expiryTimestamp = DateTimeOffset.UtcNow.AddHours(expiryHours).ToUnixTimeSeconds();
                    var ephemeralUser = $"{expiryTimestamp}:{User.Identity?.Name ?? "jusoor-user"}";
                    using var hmac = new HMACSHA1(Encoding.UTF8.GetBytes(turnSecret));
                    var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(ephemeralUser));
                    var credential = Convert.ToBase64String(hash);

                    var urls = turnServer.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                    iceServers.Add(new
                    {
                        urls,
                        username = ephemeralUser,
                        credential
                    });
                    hasTurn = true;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to compute ephemeral TURN credentials.");
                }
            }
            // Scenario 2: Static TURN credentials
            else if (!string.IsNullOrWhiteSpace(turnServer) && !string.IsNullOrWhiteSpace(turnUsername) && !string.IsNullOrWhiteSpace(turnCredential))
            {
                var urls = turnServer.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                iceServers.Add(new
                {
                    urls,
                    username = turnUsername,
                    credential = turnCredential
                });
                hasTurn = true;
            }

            return Ok(new
            {
                iceServers,
                hasTurn,
                mode = hasTurn ? "STUN_AND_TURN" : "STUN_ONLY"
            });
        }
    }
}
