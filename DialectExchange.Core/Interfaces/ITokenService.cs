using DialectExchange.Core.Entities;

namespace DialectExchange.Core.Interfaces
{
    public interface ITokenService
    {
        string CreateToken(AppUser user);
    }
}