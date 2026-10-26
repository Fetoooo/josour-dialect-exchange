using DialectExchange.API.Hubs;
using DialectExchange.Core.Entities;
using DialectExchange.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using DialectExchange.Core.Interfaces;
using DialectExchange.Infrastructure.Services;
using Microsoft.OpenApi.Models;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Http.Features;
using System.Net;

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    WebRootPath = "wwwroot"
});

// Load local development settings if present (excluded from Git via .gitignore)
builder.Configuration.AddJsonFile("appsettings.local.json", optional: true, reloadOnChange: true);
builder.Configuration.AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.local.json", optional: true, reloadOnChange: true);

// Hosting & Request size limits (120 MB max request body to accommodate 100 MB video + 10 MB thumbnail + multipart overhead)
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 125_829_120; // 120 MB
});

builder.Services.Configure<IISServerOptions>(options =>
{
    options.MaxRequestBodySize = 125_829_120; // 120 MB for IIS in-process hosting
});

builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 125_829_120; // 120 MB
    options.ValueLengthLimit = 104_857_600;
});

// Configure Forwarded Headers for reverse proxies
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.ForwardLimit = builder.Configuration.GetValue<int>("ForwardedHeaders:ForwardLimit", 1);

    var trustedProxies = builder.Configuration.GetSection("ForwardedHeaders:TrustedProxies").Get<string[]>();
    var trustedNetworks = builder.Configuration.GetSection("ForwardedHeaders:TrustedNetworks").Get<string[]>();

    if ((trustedProxies != null && trustedProxies.Length > 0) || (trustedNetworks != null && trustedNetworks.Length > 0))
    {
        options.KnownNetworks.Clear();
        options.KnownProxies.Clear();

        if (trustedProxies != null)
        {
            foreach (var proxy in trustedProxies)
            {
                if (IPAddress.TryParse(proxy, out var ip))
                {
                    options.KnownProxies.Add(ip);
                }
            }
        }

        if (trustedNetworks != null)
        {
            foreach (var network in trustedNetworks)
            {
                var parts = network.Split('/');
                if (parts.Length == 2 &&
                    IPAddress.TryParse(parts[0], out var netIp) &&
                    int.TryParse(parts[1], out var prefix))
                {
                    options.KnownNetworks.Add(new Microsoft.AspNetCore.HttpOverrides.IPNetwork(netIp, prefix));
                }
            }
        }
    }
    // Default safe behavior: when no explicit external proxies/networks are configured,
    // ASP.NET Core retains its default KnownNetworks (loopback: 127.0.0.1, ::1).
    // This safely trusts local co-located reverse proxies while rejecting arbitrary spoofed
    // X-Forwarded-For headers from untrusted direct connections.
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(opt =>
{
    opt.SwaggerDoc("v1", new OpenApiInfo { Title = "DialectExchange API", Version = "v1" });
    opt.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        In = ParameterLocation.Header,
        Description = "Please enter token (Format: 'Bearer {your_token}')",
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        BearerFormat = "JWT",
        Scheme = "bearer"
    });
    opt.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            new string[]{}
        }
    });
});

// Configurable CORS for production & development origins
var configuredOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>();
var allowedOrigins = (configuredOrigins != null && configuredOrigins.Length > 0)
    ? configuredOrigins
    : new[] { builder.Configuration["FrontendBaseUrl"] ?? "http://localhost:4200" };


builder.Services.AddCors(options =>
{
    options.AddPolicy("AngularApp", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials(); // Required for SignalR WebSocket
    });
});

// Rate limiting setup
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.ContentType = "application/json";
        await context.HttpContext.Response.WriteAsync(
            "{\"message\":\"تم تجاوز الحد المسموح من الطلبات. يرجى الانتظار قليلاً والمحاولة لاحقاً.\",\"error\":\"Too many requests\"}",
            cancellationToken: token);
    };

    // 1. Auth policy: max 10 requests per minute per IP
    options.AddPolicy("AuthPolicy", httpContext =>
    {
        var clientIp = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown_client";
        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: clientIp,
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            });
    });

    // 2. AI policy: max 15 requests per minute per authenticated user (or IP)
    options.AddPolicy("AiPolicy", httpContext =>
    {
        var key = httpContext.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
            ?? httpContext.Connection.RemoteIpAddress?.ToString()
            ?? "unknown_ai_client";
        return RateLimitPartition.GetSlidingWindowLimiter(
            partitionKey: key,
            factory: _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = 15,
                Window = TimeSpan.FromMinutes(1),
                SegmentsPerWindow = 3,
                QueueLimit = 0
            });
    });

    // 3. Upload policy: max 20 uploads per minute per user
    options.AddPolicy("UploadPolicy", httpContext =>
    {
        var key = httpContext.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
            ?? httpContext.Connection.RemoteIpAddress?.ToString()
            ?? "unknown_uploader";
        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: key,
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 20,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            });
    });
});

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
{
    Console.WriteLine("[CRITICAL CONFIG WARNING] 'ConnectionStrings:DefaultConnection' is not set. Database features will be unavailable until set in hosting environment variables.");
    connectionString = "Host=127.0.0.1;Port=5432;Database=placeholder;Username=placeholder;Password=placeholder;";
}

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.AddIdentity<AppUser, IdentityRole>(options =>
    options.User.RequireUniqueEmail = true)
    .AddEntityFrameworkStores<AppDbContext>()
    .AddDefaultTokenProviders();

builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<ICloudinaryService, CloudinaryService>();
builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();
builder.Services.AddHttpClient<IAiAssistantService, OpenRouterService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(60);
});

// Register SignalR
builder.Services.AddSignalR();

var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32)
{
    Console.WriteLine("[WARNING] 'Jwt:Key' is not set in environment variables or is under 32 chars. Using resilient signing key.");
    jwtKey = "DialectExchangeProductionFallbackSigningKeyMustBeOver32CharsLong2026!";
}
var key = Encoding.UTF8.GetBytes(jwtKey);

var issuer = builder.Configuration["Jwt:Issuer"];
if (string.IsNullOrWhiteSpace(issuer))
{
    issuer = "DialectExchangeAPI";
}

var audience = builder.Configuration["Jwt:Audience"];
if (string.IsNullOrWhiteSpace(audience))
{
    audience = "DialectExchangeApp";
}

var cloudName = builder.Configuration["Cloudinary:CloudName"];
var cloudKey = builder.Configuration["Cloudinary:ApiKey"];
var cloudSecret = builder.Configuration["Cloudinary:ApiSecret"];
if (string.IsNullOrWhiteSpace(cloudName) || string.IsNullOrWhiteSpace(cloudKey) || string.IsNullOrWhiteSpace(cloudSecret))
{
    Console.WriteLine("[WARNING] Cloudinary credentials are not fully configured. Media uploads will report unconfigured until set.");
}

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ValidateIssuer = true,
        ValidIssuer = issuer,
        ValidateAudience = true,
        ValidAudience = audience,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };

    // ← NEW: Allow SignalR to read JWT from query string (WebSocket can't set headers)
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs/chat"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});

var app = builder.Build();

app.UseForwardedHeaders();

// HTTP Security Headers
app.Use(async (context, next) =>
{
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Append("X-Frame-Options", "DENY");
    context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
    context.Response.Headers.Append("X-XSS-Protection", "0");
    await next();
});

if (!app.Environment.IsDevelopment())
{
    if (!app.Configuration.GetValue<bool>("DisableHttpsRedirection", false))
    {
        app.UseHttpsRedirection();
    }
    app.UseExceptionHandler(appError =>
    {
        appError.Run(async context =>
        {
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync("{\"message\":\"حدث خطأ غير متوقع في الخادم. يرجى المحاولة لاحقاً.\"}");
        });
    });
}

// Serve Angular SPA static files from wwwroot before routing/CORS to ensure static files are not intercepted by endpoint routing
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseRouting();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AngularApp");

app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();
app.MapControllers();

// Map the SignalR hub
app.MapHub<ChatHub>("/hubs/chat");

// Angular SPA fallback for client-side deep links (e.g. /explore, /messages, /dialect/2)
// Does not intercept /api/*, /hubs/*, or /swagger routes
app.MapFallbackToFile("{*path:regex(^(?!(api|hubs|swagger)).*$)}", "index.html");


using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<AppDbContext>();

        // Safe Migration Policy:
        // In Development or if explicitly enabled by configuration, apply EF Core migrations automatically.
        // In Staging/Production on IIS, migrations should be applied out-of-band via SQL scripts or CI/CD to prevent startup deadlocks.
        if (app.Environment.IsDevelopment() || app.Configuration.GetValue<bool>("Database:ApplyMigrationsOnStartup", false))
        {
            await context.Database.MigrateAsync();
        }

        // Idempotently seed core dialects if table is empty (safe for all environments; checks AnyAsync first)
        await DialectExchange.Infrastructure.Data.Seed.DialectSeeder.SeedAsync(context);

        // Demo user seed is strictly isolated to Development environment
        if (app.Environment.IsDevelopment())
        {
            var userManager = services.GetRequiredService<UserManager<AppUser>>();
            await DialectExchange.Infrastructure.Data.Seed.DialectSeeder.SeedDemoUserAsync(
                userManager,
                app.Configuration);
        }
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "An error occurred during migration/seeding.");
    }
}

if (app.Environment.IsDevelopment())
{
    app.MapGet("/", context => {
        context.Response.Redirect("/swagger");
        return Task.CompletedTask;
    });
}

app.Run();