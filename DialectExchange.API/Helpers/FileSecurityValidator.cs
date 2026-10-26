namespace DialectExchange.API.Helpers
{
    public static class FileSecurityValidator
    {
        // Signatures of known dangerous executables & scripts
        private static readonly byte[] WindowsExeSignature = { 0x4D, 0x5A }; // "MZ"
        private static readonly byte[] LinuxElfSignature = { 0x7F, 0x45, 0x4C, 0x46 }; // ELF
        private static readonly byte[] UnixScriptSignature = { 0x23, 0x21 }; // "#!"

        public static (bool IsValid, string? ErrorMessage) ValidateVideo(IFormFile file, long maxBytes = 104_857_600)
        {
            var baseCheck = ValidateCommon(file, maxBytes);
            if (!baseCheck.IsValid) return baseCheck;

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            var allowedExts = new[] { ".mp4", ".mov", ".webm", ".mkv", ".3gp" };
            if (!allowedExts.Contains(ext))
                return (false, "صيغة الفيديو غير مدعومة. الصيغ المسموحة: mp4, mov, webm, mkv, 3gp.");

            using var stream = file.OpenReadStream();
            if (HasDangerousSignature(stream))
                return (false, "تم رفض الملف لأنه يحتوي على توقيع تنفيذي أو برمجي غير مصرح به.");

            if (!MatchesVideoSignature(stream, ext))
                return (false, "محتوى الملف لا يطابق صيغة الفيديو المحددة، يرجى التأكد من سلامة الملف.");

            return (true, null);
        }

        public static (bool IsValid, string? ErrorMessage) ValidateAudio(IFormFile file, long maxBytes = 104_857_600)
        {
            var baseCheck = ValidateCommon(file, maxBytes);
            if (!baseCheck.IsValid) return baseCheck;

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            var allowedExts = new[] { ".mp3", ".wav", ".ogg", ".m4a", ".aac", ".weba" };
            if (!allowedExts.Contains(ext))
                return (false, "صيغة الصوت غير مدعومة. الصيغ المسموحة: mp3, wav, ogg, m4a, aac, weba.");

            using var stream = file.OpenReadStream();
            if (HasDangerousSignature(stream))
                return (false, "تم رفض الملف لأنه يحتوي على توقيع تنفيذي أو برمجي غير مصرح به.");

            if (!MatchesAudioSignature(stream, ext))
                return (false, "محتوى الملف لا يطابق صيغة الصوت المحددة.");

            return (true, null);
        }

        public static (bool IsValid, string? ErrorMessage) ValidateImage(IFormFile file, long maxBytes = 10_485_760)
        {
            var baseCheck = ValidateCommon(file, maxBytes);
            if (!baseCheck.IsValid) return baseCheck;

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            var allowedExts = new[] { ".jpg", ".jpeg", ".png", ".webp", ".gif" };
            if (!allowedExts.Contains(ext))
                return (false, "صيغة الصورة غير مدعومة. الصيغ المسموحة: jpg, jpeg, png, webp, gif.");

            using var stream = file.OpenReadStream();
            if (HasDangerousSignature(stream))
                return (false, "تم رفض الملف لأنه يحتوي على توقيع تنفيذي أو برمجي غير مصرح به.");

            if (!MatchesImageSignature(stream, ext))
                return (false, "محتوى الملف لا يطابق صيغة الصورة المحددة.");

            return (true, null);
        }

        public static (bool IsValid, string? ErrorMessage) ValidateMessageAttachment(IFormFile file, long maxBytes = 52_428_800)
        {
            var baseCheck = ValidateCommon(file, maxBytes);
            if (!baseCheck.IsValid) return baseCheck;

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            var blockedExts = new[] { ".exe", ".dll", ".bat", ".cmd", ".sh", ".php", ".ps1", ".vbs", ".msi", ".jar", ".com", ".scr" };
            if (blockedExts.Contains(ext))
                return (false, "نوع الملف المرفوع غير مسموح به لدواعي الأمان.");

            using var stream = file.OpenReadStream();
            if (HasDangerousSignature(stream))
                return (false, "تم رفض المرفق لأنه يحتوي على توقيع تنفيذي غير مصرح به.");

            return (true, null);
        }

        private static (bool IsValid, string? ErrorMessage) ValidateCommon(IFormFile file, long maxBytes)
        {
            if (file == null || file.Length == 0)
                return (false, "الملف فارغ أو غير موجود.");

            if (file.Length > maxBytes)
                return (false, $"حجم الملف يتجاوز الحد الأقصى المسموح به ({maxBytes / (1024 * 1024)} ميجابايت).");

            return (true, null);
        }

        private static bool HasDangerousSignature(Stream stream)
        {
            stream.Position = 0;
            var header = new byte[8];
            var bytesRead = stream.Read(header, 0, header.Length);
            stream.Position = 0;

            if (bytesRead < 2) return false;

            // Windows MZ executable
            if (header[0] == WindowsExeSignature[0] && header[1] == WindowsExeSignature[1])
                return true;

            // Linux ELF
            if (bytesRead >= 4 &&
                header[0] == LinuxElfSignature[0] &&
                header[1] == LinuxElfSignature[1] &&
                header[2] == LinuxElfSignature[2] &&
                header[3] == LinuxElfSignature[3])
                return true;

            // Unix script #!
            if (header[0] == UnixScriptSignature[0] && header[1] == UnixScriptSignature[1])
                return true;

            return false;
        }

        private static bool MatchesImageSignature(Stream stream, string ext)
        {
            stream.Position = 0;
            var header = new byte[12];
            var bytesRead = stream.Read(header, 0, header.Length);
            stream.Position = 0;

            if (bytesRead < 3) return false;

            // JPEG: FF D8 FF
            if (ext is ".jpg" or ".jpeg")
                return header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF;

            // PNG: 89 50 4E 47 0D 0A 1A 0A
            if (ext == ".png")
                return bytesRead >= 8 && header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47;

            // GIF: GIF8
            if (ext == ".gif")
                return bytesRead >= 4 && header[0] == 0x47 && header[1] == 0x49 && header[2] == 0x46 && header[3] == 0x38;

            // WebP: RIFF ... WEBP
            if (ext == ".webp")
                return bytesRead >= 12 && header[0] == 0x52 && header[1] == 0x49 && header[2] == 0x46 && header[3] == 0x46 &&
                       header[8] == 0x57 && header[9] == 0x45 && header[10] == 0x42 && header[11] == 0x50;

            return true;
        }

        private static bool MatchesVideoSignature(Stream stream, string ext)
        {
            stream.Position = 0;
            var header = new byte[16];
            var bytesRead = stream.Read(header, 0, header.Length);
            stream.Position = 0;

            if (bytesRead < 8) return false;

            // MP4 / MOV / 3GP has 'ftyp' at bytes 4..7
            if (ext is ".mp4" or ".mov" or ".3gp")
            {
                return (header[4] == 0x66 && header[5] == 0x74 && header[6] == 0x79 && header[7] == 0x70) ||
                       (header[0] == 0x00 && header[1] == 0x00 && header[2] == 0x00);
            }

            // WebM / MKV starts with 0x1A 0x45 0xDF 0xA3 (EBML)
            if (ext is ".webm" or ".mkv")
            {
                return header[0] == 0x1A && header[1] == 0x45 && header[2] == 0xDF && header[3] == 0xA3;
            }

            return true;
        }

        private static bool MatchesAudioSignature(Stream stream, string ext)
        {
            stream.Position = 0;
            var header = new byte[12];
            var bytesRead = stream.Read(header, 0, header.Length);
            stream.Position = 0;

            if (bytesRead < 4) return false;

            // MP3: "ID3" (0x49 0x44 0x33) or MPEG sync word (0xFF 0xFB/F3/F2)
            if (ext == ".mp3")
            {
                return (header[0] == 0x49 && header[1] == 0x44 && header[2] == 0x33) ||
                       (header[0] == 0xFF && (header[1] & 0xE0) == 0xE0);
            }

            // WAV: "RIFF" ... "WAVE"
            if (ext == ".wav")
            {
                return bytesRead >= 12 && header[0] == 0x52 && header[1] == 0x49 && header[2] == 0x46 && header[3] == 0x46 &&
                       header[8] == 0x57 && header[9] == 0x41 && header[10] == 0x56 && header[11] == 0x45;
            }

            // Ogg: "OggS" (0x4F 0x67 0x67 0x53)
            if (ext == ".ogg")
            {
                return header[0] == 0x4F && header[1] == 0x67 && header[2] == 0x67 && header[3] == 0x53;
            }

            // M4A / AAC: 'ftyp' at offset 4
            if (ext is ".m4a" or ".aac")
            {
                return (header[4] == 0x66 && header[5] == 0x74 && header[6] == 0x79 && header[7] == 0x70) ||
                       (header[0] == 0xFF && (header[1] & 0xF0) == 0xF0);
            }

            // WebA (EBML)
            if (ext == ".weba")
            {
                return header[0] == 0x1A && header[1] == 0x45 && header[2] == 0xDF && header[3] == 0xA3;
            }

            return true;
        }
    }
}
