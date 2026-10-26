using DialectExchange.Core.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace DialectExchange.Infrastructure.Data.Seed
{
    public class DialectSeeder
    {
        public static async Task SeedAsync(AppDbContext context)
        {
            // If there are already dialects in the database, do nothing
            if (await context.Dialects.AnyAsync()) return;

            var dialects = new List<Dialect>
            {
                new Dialect { Id = Guid.Parse("3ce6f6a4-af09-471a-bc08-0fd73db19936"), NameAr = "المصرية", NameEn = "Egyptian", Country = "مصر", FlagEmoji = "🇪🇬" },
                new Dialect { Id = Guid.Parse("8d00c7c9-ac3b-470d-9e10-049b4cc763bc"), NameAr = "الشامية", NameEn = "Levantine", Country = "سوريا/لبنان", FlagEmoji = "🇸🇾" },
                new Dialect { Id = Guid.Parse("9ad8d247-83a6-40b6-bfaf-babd9c6f3296"), NameAr = "الخليجية", NameEn = "Gulf", Country = "السعودية", FlagEmoji = "🇸🇦" },
                new Dialect { Id = Guid.Parse("87c7a144-f198-4dce-85ec-6c28bc8fbd8d"), NameAr = "العراقية", NameEn = "Iraqi", Country = "العراق", FlagEmoji = "🇮🇶" },
                new Dialect { Id = Guid.Parse("af801238-f7fb-41c4-80e4-7dd1a5a20ac6"), NameAr = "المغربية", NameEn = "Moroccan", Country = "المغرب", FlagEmoji = "🇲🇦" },
                new Dialect { Id = Guid.Parse("4fbd3ed8-8420-4b29-b8e7-fc9af645b335"), NameAr = "التونسية", NameEn = "Tunisian", Country = "تونس", FlagEmoji = "🇹🇳" },
                new Dialect { Id = Guid.Parse("c16e3835-2f84-40b0-8984-87347e14c56d"), NameAr = "الجزائرية", NameEn = "Algerian", Country = "الجزائر", FlagEmoji = "🇩🇿" },
                new Dialect { Id = Guid.Parse("9771371e-df21-4787-9a3e-2997d3cd909d"), NameAr = "الليبية", NameEn = "Libyan", Country = "ليبيا", FlagEmoji = "🇱🇾" },
                new Dialect { Id = Guid.Parse("25e05995-5e53-4069-9369-b431d6e8a686"), NameAr = "اليمنية", NameEn = "Yemeni", Country = "اليمن", FlagEmoji = "🇾🇪" },
                new Dialect { Id = Guid.Parse("57fd823c-297c-44dc-a6b0-b9196c91570c"), NameAr = "الأردنية", NameEn = "Jordanian", Country = "الأردن", FlagEmoji = "🇯🇴" },
                new Dialect { Id = Guid.Parse("53f49bc2-60bd-425b-98eb-11676238c667"), NameAr = "الفلسطينية", NameEn = "Palestinian", Country = "فلسطين", FlagEmoji = "🇵🇸" },
                new Dialect { Id = Guid.Parse("b2540480-bbab-41ca-9ad1-b345bee434e4"), NameAr = "السودانية", NameEn = "Sudanese", Country = "السودان", FlagEmoji = "🇸🇩" }
            };

            await context.Dialects.AddRangeAsync(dialects);
            await context.SaveChangesAsync();
        }

        public static async Task SeedDemoUserAsync(
            UserManager<AppUser> userManager,
            IConfiguration configuration)
        {
            var email = configuration["DemoUser:Email"];
            var password = configuration["DemoUser:Password"];

            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
                throw new InvalidOperationException("Demo user credentials are not configured.");

            if (await userManager.FindByEmailAsync(email) is not null)
                return;

            var user = new AppUser
            {
                UserName = email,
                Email = email,
                EmailConfirmed = true,
                IsVerified = true,
                DisplayNameAr = "مستخدم تجريبي",
                DisplayNameEn = "Demo User"
            };

            var result = await userManager.CreateAsync(user, password);
            if (!result.Succeeded)
            {
                var errors = string.Join("; ", result.Errors.Select(error => $"{error.Code}: {error.Description}"));
                throw new InvalidOperationException($"Unable to seed demo user: {errors}");
            }
        }
    }
}