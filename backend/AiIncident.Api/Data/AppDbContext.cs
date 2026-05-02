using AiIncident.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using System.Text.Json;

namespace AiIncident.Api.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Team> Teams => Set<Team>();
    public DbSet<Ticket> Tickets => Set<Ticket>();
    public DbSet<Comment> Comments => Set<Comment>();
    public DbSet<TicketHistoryEntry> TicketHistoryEntries => Set<TicketHistoryEntry>();
    public DbSet<Attachment> Attachments => Set<Attachment>();
    public DbSet<MediaAsset> MediaAssets => Set<MediaAsset>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var stringListConverter = new ValueConverter<List<string>, string>(
            value => JsonSerializer.Serialize(value, (JsonSerializerOptions?)null),
            value => JsonSerializer.Deserialize<List<string>>(value, (JsonSerializerOptions?)null) ?? new List<string>());

        modelBuilder.Entity<User>().HasKey(x => x.Id);
        modelBuilder.Entity<Team>().HasKey(x => x.Id);

        modelBuilder.Entity<Ticket>().HasKey(x => x.Id);
        modelBuilder.Entity<Ticket>()
            .Property(x => x.Tags)
            .HasConversion(stringListConverter);
        modelBuilder.Entity<Ticket>()
            .Property(x => x.RelatedTicketIds)
            .HasConversion(stringListConverter);
        modelBuilder.Entity<Ticket>()
            .HasOne(x => x.Assignee)
            .WithMany()
            .HasForeignKey(x => x.AssigneeId)
            .OnDelete(DeleteBehavior.NoAction);
        modelBuilder.Entity<Ticket>()
            .HasOne(x => x.Requester)
            .WithMany()
            .HasForeignKey(x => x.RequesterId)
            .OnDelete(DeleteBehavior.NoAction);
        modelBuilder.Entity<Ticket>()
            .HasOne(x => x.Team)
            .WithMany()
            .HasForeignKey(x => x.TeamId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Comment>().HasKey(x => x.Id);
        modelBuilder.Entity<Comment>()
            .HasOne(x => x.Ticket)
            .WithMany(x => x.Comments)
            .HasForeignKey(x => x.TicketId);
        modelBuilder.Entity<Comment>()
            .HasOne(x => x.Author)
            .WithMany()
            .HasForeignKey(x => x.AuthorId)
            .OnDelete(DeleteBehavior.NoAction);

        modelBuilder.Entity<TicketHistoryEntry>().HasKey(x => x.Id);
        modelBuilder.Entity<TicketHistoryEntry>()
            .HasOne(x => x.Ticket)
            .WithMany(x => x.History)
            .HasForeignKey(x => x.TicketId);

        modelBuilder.Entity<Attachment>().HasKey(x => x.Id);
        modelBuilder.Entity<Attachment>()
            .HasOne(x => x.Ticket)
            .WithMany(x => x.Attachments)
            .HasForeignKey(x => x.TicketId);

        modelBuilder.Entity<MediaAsset>().HasKey(x => x.Id);
        modelBuilder.Entity<MediaAsset>()
            .HasOne(x => x.UploadedByUser)
            .WithMany()
            .HasForeignKey(x => x.UploadedByUserId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}
