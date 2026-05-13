using AiIncident.Api.Models;
using AiIncident.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace AiIncident.Api.Data;

public static class AppSeeder
{
    public static void Seed(AppDbContext db, IPasswordHasher passwordHasher)
    {
        if (db.Tenants.Any())
        {
            return;
        }

        var now = DateTime.UtcNow;
        const string demoTenantId = "tenant-demo";
        const string defaultPassword = "demo";

        var tenant = new Tenant
        {
            Id = demoTenantId,
            Name = "Demo Corporation",
            Slug = "demo",
            Status = TenantStatus.Active,
            CreatedAt = now,
            UpdatedAt = now
        };
        db.Tenants.Add(tenant);
        db.TenantEmailDomains.Add(new TenantEmailDomain
        {
            Domain = "example.com",
            TenantId = demoTenantId,
            IsPrimary = true
        });

        var superAdmin = new User
        {
            Id = "u-super-admin",
            TenantId = null,
            Name = "Platform Super Admin",
            Email = "super@ai-platform.internal",
            Role = UserRole.SUPER_ADMIN,
            PasswordHash = passwordHasher.HashPassword(defaultPassword),
            IsActive = true
        };
        db.Users.Add(superAdmin);

        var users = new[]
        {
            new User
            {
                Id = "u-tenant-admin",
                TenantId = demoTenantId,
                Name = "Taylor Tenant Admin",
                Email = "admin@example.com",
                Role = UserRole.TENANT_ADMIN,
                PasswordHash = passwordHasher.HashPassword(defaultPassword),
                IsActive = true
            },
            new User
            {
                Id = "u-agent",
                TenantId = demoTenantId,
                Name = "Alex Agent",
                Email = "alex@example.com",
                Role = UserRole.AGENT,
                PasswordHash = passwordHasher.HashPassword(defaultPassword),
                IsActive = true
            },
            new User
            {
                Id = "u-manager",
                TenantId = demoTenantId,
                Name = "Morgan Manager",
                Email = "morgan@example.com",
                Role = UserRole.MANAGER,
                PasswordHash = passwordHasher.HashPassword(defaultPassword),
                IsActive = true
            },
            new User
            {
                Id = "u-requester",
                TenantId = demoTenantId,
                Name = "Riley Requester",
                Email = "riley@example.com",
                Role = UserRole.REQUESTER,
                PasswordHash = passwordHasher.HashPassword(defaultPassword),
                IsActive = true
            }
        };
        db.Users.AddRange(users);

        var teamNames = new[] { "Network", "Identity", "Platform", "Support" };
        var teams = teamNames.Select((name, index) => new Team
        {
            Id = $"{demoTenantId}-tm-{index + 1}",
            TenantId = demoTenantId,
            Name = name
        }).ToArray();
        db.Teams.AddRange(teams);

        var titles = new[]
        {
            "VPN fails on office WiFi", "Email sync delays", "MFA reset for contractor", "Laptop disk warning",
            "API gateway 502 spikes", "Jira webhook retries", "Printer queue stuck", "SSL cert renewal",
            "AD group membership sync", "Backup job failure", "VPN split tunnel question", "Git runner offline",
            "PagerDuty routing wrong team", "Snowflake query timeout", "Office 365 license reclaim",
            "WiFi captive portal loop", "HR system SSO error", "Kubernetes node NotReady",
            "Database connection pool exhausted", "S3 bucket policy review"
        };

        var statuses = new[] { TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED, TicketStatus.CLOSED };
        var priorities = new[] { TicketPriority.P1, TicketPriority.P2, TicketPriority.P3, TicketPriority.P4 };

        for (var i = 0; i < titles.Length; i++)
        {
            var idx = i + 1;
            var status = statuses[i % 4];
            var priority = priorities[i % 4];
            var slaBreached = priority == TicketPriority.P1 && status == TicketStatus.OPEN;
            var created = DateTime.UtcNow.AddDays(-idx);
            var team = teams[i % teams.Length];
            var ticketId = $"t-{idx}";

            var ticket = new Ticket
            {
                Id = ticketId,
                TenantId = demoTenantId,
                Title = titles[i],
                Description = $"Detailed description for {titles[i]}. Environment: prod. Steps to reproduce documented internally.",
                Status = status,
                Priority = priority,
                AssigneeId = idx % 3 == 0 ? null : "u-agent",
                RequesterId = "u-requester",
                TeamId = team.Id,
                Category = idx % 2 == 0 ? "Incident" : "Service Request",
                Tags = idx % 2 == 0 ? ["vpn", "wifi"] : ["email", "mfa"],
                SlaDueAt = DateTime.UtcNow.AddHours(slaBreached ? -1 : 48),
                SlaBreached = slaBreached,
                CreatedAt = created,
                UpdatedAt = DateTime.UtcNow,
                RelatedTicketIds = idx > 1 ? [$"t-{idx - 1}"] : []
            };

            ticket.Comments.Add(new Comment
            {
                Id = $"{ticketId}-c1",
                TenantId = demoTenantId,
                TicketId = ticketId,
                AuthorId = "u-requester",
                Body = "Initial report — seeing errors in VPN client.",
                CreatedAt = created
            });
            ticket.Comments.Add(new Comment
            {
                Id = $"{ticketId}-c2",
                TenantId = demoTenantId,
                TicketId = ticketId,
                AuthorId = "u-agent",
                Body = "Thanks — checking gateway logs now.",
                CreatedAt = DateTime.UtcNow.AddHours(-idx)
            });
            ticket.History.Add(new TicketHistoryEntry
            {
                Id = $"{ticketId}-h1",
                TenantId = demoTenantId,
                TicketId = ticketId,
                Action = "CREATED",
                Details = "Ticket opened",
                CreatedAt = created
            });
            ticket.History.Add(new TicketHistoryEntry
            {
                Id = $"{ticketId}-h2",
                TenantId = demoTenantId,
                TicketId = ticketId,
                Action = "COMMENT_ADDED",
                Details = null,
                CreatedAt = DateTime.UtcNow
            });
            if (idx % 4 == 0)
            {
                ticket.Attachments.Add(new Attachment
                {
                    Id = $"{ticketId}-a1",
                    TenantId = demoTenantId,
                    TicketId = ticketId,
                    FileName = "trace.log",
                    Url = "/api/files/trace.log",
                    UploadedAt = created
                });
            }

            db.Tickets.Add(ticket);
        }

        db.SaveChanges();
    }
}
