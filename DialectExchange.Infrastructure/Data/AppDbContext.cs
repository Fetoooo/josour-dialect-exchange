using DialectExchange.Core.Entities;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace DialectExchange.Infrastructure.Data
{
    public class AppDbContext : IdentityDbContext<AppUser>
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }

        public DbSet<Dialect> Dialects { get; set; }
        public DbSet<Exchange> Exchanges { get; set; }
        public DbSet<Transcript> Transcripts { get; set; }
        public DbSet<TranscriptWord> TranscriptWords { get; set; }
        public DbSet<Comment> Comments { get; set; }
        public DbSet<Message> Messages { get; set; } // ← NEW
        public DbSet<ExchangeLike> ExchangeLikes { get; set; }

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            builder.Entity<AppUser>()
                .HasOne(u => u.NativeDialect)
                .WithMany()
                .HasForeignKey(u => u.NativeDialectId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.Entity<AppUser>()
                .HasIndex(u => u.NormalizedEmail)
                .IsUnique();

            builder.Entity<Comment>()
                .HasOne(c => c.Exchange)
                .WithMany(e => e.Comments)
                .HasForeignKey(c => c.ExchangeId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<Comment>()
                .HasOne(c => c.Author)
                .WithMany()
                .HasForeignKey(c => c.AuthorId)
                .OnDelete(DeleteBehavior.Cascade);

            // Message relationships — restrict delete to avoid multiple cascade paths
            builder.Entity<Message>()
                .HasOne(m => m.Sender)
                .WithMany()
                .HasForeignKey(m => m.SenderId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.Entity<Message>()
                .HasOne(m => m.Receiver)
                .WithMany()
                .HasForeignKey(m => m.ReceiverId)
                .OnDelete(DeleteBehavior.Restrict);

            // ExchangeLike configuration — one like per user per exchange
            builder.Entity<ExchangeLike>(entity =>
            {
                entity.HasKey(el => el.Id);
                entity.HasIndex(el => new { el.UserId, el.ExchangeId }).IsUnique();

                entity.HasOne(el => el.Exchange)
                    .WithMany()
                    .HasForeignKey(el => el.ExchangeId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(el => el.User)
                    .WithMany()
                    .HasForeignKey(el => el.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });
        }
    }
}