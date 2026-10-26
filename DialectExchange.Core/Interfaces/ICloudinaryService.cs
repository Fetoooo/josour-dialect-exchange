using Microsoft.AspNetCore.Http;

namespace DialectExchange.Core.Interfaces
{
    public interface ICloudinaryService
    {
        Task<string> UploadVideoAsync(IFormFile file);
        Task<string> UploadAudioAsync(IFormFile file);
        Task<string> UploadImageAsync(IFormFile file); 
        Task<string> UploadFileAsync(IFormFile file);
        Task DeleteFileAsync(string publicId);
    }
}