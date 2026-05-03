using AiIncident.Api.Data;
using AiIncident.Api.Models;
using AiIncident.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace AiIncident.Api.GraphQL;

public sealed class Mutation
{
    public async Task<Ticket> CreateTicket(
        CreateTicketInput input,
        [Service] AppDbContext db,
        [Service] ICurrentUserContext ctx,
        CancellationToken cancellationToken)
    {
        var tenantId = TenantScopeGuard.RequireTenantId(ctx);
        var userId = TenantScopeGuard.RequireUserId(ctx);

        var now = DateTime.UtcNow;
        var nextId = await NextTicketId(db, tenantId, cancellationToken);

        var defaultTeam = await db.Teams.AsNoTracking()
            .Where(t => t.TenantId == tenantId)
            .OrderBy(t => t.Id)
            .FirstOrDefaultAsync(cancellationToken);

        var ticket = new Ticket
        {
            Id = nextId,
            TenantId = tenantId,
            Title = input.Title.Trim(),
            Description = input.Description.Trim(),
            Priority = input.Priority,
            Status = TicketStatus.OPEN,
            Category = input.Category.Trim(),
            RequesterId = userId,
            TeamId = defaultTeam?.Id,
            Tags = input.Tags is { Count: > 0 }
                ? input.Tags.Where(tag => !string.IsNullOrWhiteSpace(tag)).Select(tag => tag.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).ToList()
                : ["new"],
            SlaDueAt = now.AddHours(48),
            SlaBreached = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        ticket.History.Add(new TicketHistoryEntry
        {
            Id = $"{ticket.Id}-h-create",
            TenantId = tenantId,
            TicketId = ticket.Id,
            Action = "CREATED",
            Details = "Ticket opened",
            CreatedAt = now
        });

        if (input.AttachmentIds is { Count: > 0 })
        {
            var selectedAssets = await db.MediaAssets
                .Where(asset => input.AttachmentIds.Contains(asset.Id) && asset.TenantId == tenantId)
                .ToListAsync(cancellationToken);
            foreach (var asset in selectedAssets)
            {
                ticket.Attachments.Add(new Attachment
                {
                    Id = asset.Id,
                    TenantId = tenantId,
                    TicketId = ticket.Id,
                    FileName = asset.OriginalFileName,
                    Url = asset.Url,
                    UploadedAt = asset.UploadedAt
                });
            }
        }

        db.Tickets.Add(ticket);
        await db.SaveChangesAsync(cancellationToken);
        return ticket;
    }

    public async Task<Ticket> UpdateTicket(
        [ID] string id,
        UpdateTicketInput input,
        [Service] AppDbContext db,
        [Service] ICurrentUserContext ctx,
        CancellationToken cancellationToken)
    {
        var tenantId = TenantScopeGuard.RequireTenantId(ctx);
        var ticket = await db.Tickets.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId, cancellationToken)
            ?? throw new GraphQLException("Ticket not found");

        if (input.Status is not null) ticket.Status = input.Status.Value;
        if (input.Priority is not null) ticket.Priority = input.Priority.Value;
        if (!string.IsNullOrWhiteSpace(input.Title)) ticket.Title = input.Title.Trim();
        if (!string.IsNullOrWhiteSpace(input.Description)) ticket.Description = input.Description.Trim();
        if (!string.IsNullOrWhiteSpace(input.Category)) ticket.Category = input.Category.Trim();
        if (input.Tags is not null) ticket.Tags = input.Tags.Where(tag => !string.IsNullOrWhiteSpace(tag)).Select(tag => tag.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        ticket.UpdatedAt = DateTime.UtcNow;
        db.TicketHistoryEntries.Add(new TicketHistoryEntry
        {
            Id = $"{ticket.Id}-h-{Guid.NewGuid():N}".Substring(0, 18),
            TenantId = tenantId,
            TicketId = ticket.Id,
            Action = "UPDATED",
            Details = null,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync(cancellationToken);
        return await db.Tickets
            .Include(x => x.Assignee)
            .Include(x => x.Requester)
            .Include(x => x.Team)
            .Include(x => x.Comments).ThenInclude(x => x.Author)
            .Include(x => x.History)
            .Include(x => x.Attachments)
            .FirstAsync(x => x.Id == id && x.TenantId == tenantId, cancellationToken);
    }

    public async Task<Ticket> AssignTicket(
        [ID] string id,
        [ID] string assigneeId,
        [Service] AppDbContext db,
        [Service] ICurrentUserContext ctx,
        CancellationToken cancellationToken)
    {
        var tenantId = TenantScopeGuard.RequireTenantId(ctx);
        var ticket = await db.Tickets.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId, cancellationToken)
            ?? throw new GraphQLException("Ticket not found");
        var user = await db.Users.FirstOrDefaultAsync(x => x.Id == assigneeId && x.TenantId == tenantId, cancellationToken)
            ?? throw new GraphQLException("Assignee not found");

        ticket.AssigneeId = user.Id;
        ticket.UpdatedAt = DateTime.UtcNow;
        db.TicketHistoryEntries.Add(new TicketHistoryEntry
        {
            Id = $"{ticket.Id}-h-{Guid.NewGuid():N}".Substring(0, 18),
            TenantId = tenantId,
            TicketId = ticket.Id,
            Action = "ASSIGNED",
            Details = $"Assigned to {user.Name}",
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync(cancellationToken);

        return await db.Tickets
            .Include(x => x.Assignee)
            .FirstAsync(x => x.Id == id && x.TenantId == tenantId, cancellationToken);
    }

    public async Task<Comment> AddComment(
        [ID] string ticketId,
        string body,
        [Service] AppDbContext db,
        [Service] ICurrentUserContext ctx,
        CancellationToken cancellationToken)
    {
        var tenantId = TenantScopeGuard.RequireTenantId(ctx);
        var userId = TenantScopeGuard.RequireUserId(ctx);
        var ticket = await db.Tickets.FirstOrDefaultAsync(x => x.Id == ticketId && x.TenantId == tenantId, cancellationToken)
            ?? throw new GraphQLException("Ticket not found");

        var comment = new Comment
        {
            Id = $"c-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
            TenantId = tenantId,
            TicketId = ticketId,
            AuthorId = userId,
            Body = body.Trim(),
            CreatedAt = DateTime.UtcNow
        };
        ticket.UpdatedAt = DateTime.UtcNow;
        db.Comments.Add(comment);
        await db.SaveChangesAsync(cancellationToken);

        return await db.Comments.Include(x => x.Author).FirstAsync(x => x.Id == comment.Id, cancellationToken);
    }

    public async Task<bool> DeleteTicket(
        [ID] string id,
        [Service] AppDbContext db,
        [Service] ICurrentUserContext ctx,
        CancellationToken cancellationToken)
    {
        var tenantId = TenantScopeGuard.RequireTenantId(ctx);
        var ticket = await db.Tickets
            .Include(x => x.Comments)
            .Include(x => x.History)
            .Include(x => x.Attachments)
            .FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId, cancellationToken);
        if (ticket is null)
        {
            return false;
        }

        db.Comments.RemoveRange(ticket.Comments);
        db.TicketHistoryEntries.RemoveRange(ticket.History);
        db.Attachments.RemoveRange(ticket.Attachments);
        db.Tickets.Remove(ticket);
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static async Task<string> NextTicketId(AppDbContext db, string tenantId, CancellationToken cancellationToken)
    {
        var max = await db.Tickets
            .Where(t => t.TenantId == tenantId)
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);
        var next = max
            .Select(id => id.StartsWith("t-") && int.TryParse(id[2..], out var parsed) ? parsed : 0)
            .DefaultIfEmpty(0)
            .Max() + 1;
        return $"t-{next}";
    }
}
