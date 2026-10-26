using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using DialectExchange.Core.Interfaces;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace DialectExchange.Infrastructure.Services
{
    public class CloudinaryService : ICloudinaryService
    {
        private readonly Cloudinary? _cloudinary;
        private readonly ILogger<CloudinaryService> _logger;
        private readonly IWebHostEnvironment? _environment;

        public CloudinaryService(
            IConfiguration config, 
            ILogger<CloudinaryService> logger,
            IWebHostEnvironment? environment = null)
        {
            _logger = logger;
            _environment = environment;

            var cloudName = config["Cloudinary:CloudName"];
            var apiKey = config["Cloudinary:ApiKey"];
            var apiSecret = config["Cloudinary:ApiSecret"];

            if (!string.IsNullOrWhiteSpace(cloudName) && 
                !string.IsNullOrWhiteSpace(apiKey) && 
                !string.IsNullOrWhiteSpace(apiSecret))
            {
                var account = new Account(cloudName, apiKey, apiSecret);
                _cloudinary = new Cloudinary(account);
            }
            else
            {
                _logger.LogInformation("Cloudinary configuration not provided or incomplete. Using local disk storage fallback.");
            }
        }

        public async Task<string> UploadVideoAsync(IFormFile file)
        {
            if (file == null || file.Length == 0) return string.Empty;

            if (_cloudinary != null)
            {
                try
                {
                    using var stream = file.OpenReadStream();
                    var uploadParams = new VideoUploadParams
                    {
                        File = new FileDescription(file.FileName, stream),
                        Folder = "jusoor/videos"
                    };

                    var result = await _cloudinary.UploadAsync(uploadParams);
                    var url = result.SecureUrl?.ToString() ?? result.Url?.ToString() ?? string.Empty;
                    if (!string.IsNullOrEmpty(url))
                    {
                        _logger.LogInformation("Successfully uploaded video to Cloudinary: {Url}", url);
                        return url;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Cloudinary video upload failed, falling back to local storage for {FileName}", file.FileName);
                }
            }

            return await SaveLocallyAsync(file, "videos");
        }

        public async Task<string> UploadAudioAsync(IFormFile file)
        {
            if (file == null || file.Length == 0) return string.Empty;

            if (_cloudinary != null)
            {
                try
                {
                    using var stream = file.OpenReadStream();
                    var uploadParams = new RawUploadParams
                    {
                        File = new FileDescription(file.FileName, stream),
                        Folder = "jusoor/audio"
                    };

                    var result = await _cloudinary.UploadAsync(uploadParams);
                    var url = result.SecureUrl?.ToString() ?? result.Url?.ToString() ?? string.Empty;
                    if (!string.IsNullOrEmpty(url))
                    {
                        _logger.LogInformation("Successfully uploaded audio to Cloudinary: {Url}", url);
                        return url;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Cloudinary audio upload failed, falling back to local storage for {FileName}", file.FileName);
                }
            }

            return await SaveLocallyAsync(file, "audio");
        }

        public async Task<string> UploadImageAsync(IFormFile file)
        {
            if (file == null || file.Length == 0) return string.Empty;

            if (_cloudinary != null)
            {
                try
                {
                    using var stream = file.OpenReadStream();
                    var uploadParams = new ImageUploadParams
                    {
                        File = new FileDescription(file.FileName, stream),
                        Folder = "jusoor/images"
                    };
                    var result = await _cloudinary.UploadAsync(uploadParams);
                    var url = result.SecureUrl?.ToString() ?? result.Url?.ToString() ?? string.Empty;
                    if (!string.IsNullOrEmpty(url))
                    {
                        _logger.LogInformation("Successfully uploaded image to Cloudinary: {Url}", url);
                        return url;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Cloudinary image upload failed, falling back to local storage for {FileName}", file.FileName);
                }
            }

            return await SaveLocallyAsync(file, "images");
        }

        public async Task<string> UploadFileAsync(IFormFile file)
        {
            if (file == null || file.Length == 0) return string.Empty;

            if (_cloudinary != null)
            {
                try
                {
                    using var stream = file.OpenReadStream();
                    var uploadParams = new RawUploadParams
                    {
                        File = new FileDescription(file.FileName, stream),
                        Folder = "jusoor/files"
                    };
                    var result = await _cloudinary.UploadAsync(uploadParams);
                    var url = result.SecureUrl?.ToString() ?? result.Url?.ToString() ?? string.Empty;
                    if (!string.IsNullOrEmpty(url))
                    {
                        _logger.LogInformation("Successfully uploaded raw file to Cloudinary: {Url}", url);
                        return url;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Cloudinary file upload failed, falling back to local storage for {FileName}", file.FileName);
                }
            }

            return await SaveLocallyAsync(file, "files");
        }

        public async Task DeleteFileAsync(string publicId)
        {
            try
            {
                if (_cloudinary != null)
                {
                    var deleteParams = new DeletionParams(publicId);
                    await _cloudinary.DestroyAsync(deleteParams);
                    _logger.LogInformation("Deleted file {PublicId} from Cloudinary", publicId);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting file {PublicId} from Cloudinary", publicId);
            }
        }

        private async Task<string> SaveLocallyAsync(IFormFile file, string subFolder)
        {
            try
            {
                var webRoot = _environment?.WebRootPath;
                if (string.IsNullOrWhiteSpace(webRoot))
                {
                    webRoot = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
                }

                var targetDir = Path.Combine(webRoot, "uploads", subFolder);
                Directory.CreateDirectory(targetDir);

                var extension = Path.GetExtension(file.FileName);
                var safeFileName = $"{Guid.NewGuid():N}{extension}";
                var filePath = Path.Combine(targetDir, safeFileName);

                using (var targetStream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(targetStream);
                }

                var relativeUrl = $"/uploads/{subFolder}/{safeFileName}";
                _logger.LogInformation("Saved file locally to: {RelativeUrl}", relativeUrl);
                return relativeUrl;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving file locally {FileName}", file.FileName);
                return string.Empty;
            }
        }
    }
}