using DialectExchange.Core.DTOs;

namespace DialectExchange.Core.Interfaces
{
    public interface IAiAssistantService
    {
        Task<AiChatResponseDto> GetChatResponseAsync(List<AiChatMessageDto> messages, string? userContext = null);
    }
}
