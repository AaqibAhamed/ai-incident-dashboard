using AiIncident.Api.Models;

namespace AiIncident.Api.Data;

public static class AppSeeder
{
    public static void Seed(AppDbContext db)
    {
        if (db.Users.Any() || db.Tickets.Any())
        {
            return;
        }

        var users = new[]
        {
            new User { Id = "u-agent", Name = "Alex Agent", Email = "alex@example.com", Role = UserRole.AGENT },
            new User { Id = "u-manager", Name = "Morgan Manager", Email = "morgan@example.com", Role = UserRole.MANAGER },
            new User { Id = "u-requester", Name = "Riley Requester", Email = "riley@example.com", Role = UserRole.REQUESTER }
        };
        db.Users.AddRange(users);

        var teamNames = new[] { "Network", "Identity", "Platform", "Support" };
        var teams = teamNames.Select((name, index) => new Team { Id = $"t{index + 1}", Name = name }).ToArray();
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

        for (var i = 0; i < titles.Length; i++)
        {
            var idx = i + 1;
            var statuses = new[] { TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED, TicketStatus.CLOSED };
            var priorities = new[] { TicketPriority.P1, TicketPriority.P2, TicketPriority.P3, TicketPriority.P4 };
            var status = statuses[i % 4];
            var priority = priorities[i % 4];
            var slaBreached = priority == TicketPriority.P1 && status == TicketStatus.OPEN;
            var created = DateTime.UtcNow.AddDays(-idx);
            var team = teams[i % teams.Length];
            var ticketId = $"t-{idx}";

            var ticket = new Ticket
            {
                Id = ticketId,
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
                TicketId = ticketId,
                AuthorId = "u-requester",
                Body = "Initial report — seeing errors in VPN client.",
                CreatedAt = created
            });
            ticket.Comments.Add(new Comment
            {
                Id = $"{ticketId}-c2",
                TicketId = ticketId,
                AuthorId = "u-agent",
                Body = "Thanks — checking gateway logs now.",
                CreatedAt = DateTime.UtcNow.AddHours(-idx)
            });
            ticket.History.Add(new TicketHistoryEntry
            {
                Id = $"{ticketId}-h1",
                TicketId = ticketId,
                Action = "CREATED",
                Details = "Ticket opened",
                CreatedAt = created
            });
            ticket.History.Add(new TicketHistoryEntry
            {
                Id = $"{ticketId}-h2",
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
