using AiIncident.Api.Data;
using AiIncident.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AiIncident.Api.GraphQL;

public sealed class Mutation
{
    public async Task<Ticket> CreateTicket(
        CreateTicketInput input,
        [Service] AppDbContext db,
        CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var nextId = await NextTicketId(db, cancellationToken);
        var ticket = new Ticket
        {
            Id = nextId,
            Title = input.Title.Trim(),
            Description = input.Description.Trim(),
            Priority = input.Priority,
            Status = TicketStatus.OPEN,
            Category = input.Category.Trim(),
            RequesterId = "u-requester",
            TeamId = "t1",
            Tags = ["new"],
            SlaDueAt = now.AddHours(48),
            SlaBreached = false,
            CreatedAt = now,
            UpdatedAt = now
        };
        ticket.History.Add(new TicketHistoryEntry
        {
            Id = $"{ticket.Id}-h-create",
            TicketId = ticket.Id,
            Action = "CREATED",
            Details = "Ticket opened",
            CreatedAt = now
        });
        db.Tickets.Add(ticket);
        await db.SaveChangesAsync(cancellationToken);
        return ticket;
    }

    public async Task<Ticket> UpdateTicket(
        string id,
        UpdateTicketInput input,
        [Service] AppDbContext db,
        CancellationToken cancellationToken)
    {
        var ticket = await db.Tickets.FirstOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new GraphQLException("Ticket not found");

        if (input.Status is not null) ticket.Status = input.Status.Value;
        if (input.Priority is not null) ticket.Priority = input.Priority.Value;
        if (!string.IsNullOrWhiteSpace(input.Title)) ticket.Title = input.Title.Trim();
        if (!string.IsNullOrWhiteSpace(input.Description)) ticket.Description = input.Description.Trim();
        ticket.UpdatedAt = DateTime.UtcNow;
        db.TicketHistoryEntries.Add(new TicketHistoryEntry
        {
            Id = $"{ticket.Id}-h-{Guid.NewGuid():N}".Substring(0, 18),
            TicketId = ticket.Id,
            Action = "UPDATED",
            Details = null,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync(cancellationToken);
        return ticket;
    }

    public async Task<Ticket> AssignTicket(
        string id,
        string assigneeId,
        [Service] AppDbContext db,
        CancellationToken cancellationToken)
    {
        var ticket = await db.Tickets.FirstOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new GraphQLException("Ticket not found");
        var user = await db.Users.FirstOrDefaultAsync(x => x.Id == assigneeId, cancellationToken)
            ?? throw new GraphQLException("Assignee not found");

        ticket.AssigneeId = user.Id;
        ticket.UpdatedAt = DateTime.UtcNow;
        db.TicketHistoryEntries.Add(new TicketHistoryEntry
        {
            Id = $"{ticket.Id}-h-{Guid.NewGuid():N}".Substring(0, 18),
            TicketId = ticket.Id,
            Action = "ASSIGNED",
            Details = $"Assigned to {user.Name}",
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync(cancellationToken);

        return await db.Tickets
            .Include(x => x.Assignee)
            .FirstAsync(x => x.Id == id, cancellationToken);
    }

    public async Task<Comment> AddComment(
        string ticketId,
        string body,
        [Service] AppDbContext db,
        CancellationToken cancellationToken)
    {
        var ticket = await db.Tickets.FirstOrDefaultAsync(x => x.Id == ticketId, cancellationToken)
            ?? throw new GraphQLException("Ticket not found");

        var comment = new Comment
        {
            Id = $"c-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
            TicketId = ticketId,
            AuthorId = "u-agent",
            Body = body.Trim(),
            CreatedAt = DateTime.UtcNow
        };
        ticket.UpdatedAt = DateTime.UtcNow;
        db.Comments.Add(comment);
        await db.SaveChangesAsync(cancellationToken);

        return await db.Comments.Include(x => x.Author).FirstAsync(x => x.Id == comment.Id, cancellationToken);
    }

    private static async Task<string> NextTicketId(AppDbContext db, CancellationToken cancellationToken)
    {
        var max = await db.Tickets
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);
        var next = max
            .Select(id => id.StartsWith("t-") && int.TryParse(id[2..], out var parsed) ? parsed : 0)
            .DefaultIfEmpty(0)
            .Max() + 1;
        return $"t-{next}";
    }
}
