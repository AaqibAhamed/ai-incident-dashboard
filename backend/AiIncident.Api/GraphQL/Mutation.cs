using AiIncident.Api.Data;
using AiIncident.Api.Models;
using AiIncident.Api.Services;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace AiIncident.Api.GraphQL;

public sealed class Mutation(ILogger<Mutation> logger)
{
  public async Task<Ticket> CreateTicket(
    CreateTicketInput input,
    [Service] AppDbContext db,
    [Service] ICurrentUserContext ctx,
    [Service] IHubContext<TicketHub> hub,
    CancellationToken cancellationToken)
  {
    var tenantId = TenantScopeGuard.RequireTenantId(ctx);
    var userId = TenantScopeGuard.RequireUserId(ctx);

    var now = DateTime.UtcNow;
    var nextId = await NextTicketId(db, cancellationToken);

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
        ? input.Tags.Where(tag => !string.IsNullOrWhiteSpace(tag)).Select(tag => tag.Trim())
          .Distinct(StringComparer.OrdinalIgnoreCase).ToList()
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

      if (selectedAssets.Count != input.AttachmentIds.Count)
      {
        var missing = input.AttachmentIds.Except(selectedAssets.Select(a => a.Id)).ToList();
        throw new GraphQLException($"Attachment(s) not found or not accessible: {string.Join(", ", missing)}");
      }

      foreach (var asset in selectedAssets)
      {
        ticket.Attachments.Add(new Attachment
        {
          // Attachment.Id is the PK; it must be unique even if the same asset is re-attached/retried.
          Id = $"{ticket.Id}-a-{asset.Id}",
          TenantId = tenantId,
          TicketId = ticket.Id,
          FileName = asset.OriginalFileName,
          Url = asset.Url,
          UploadedAt = asset.UploadedAt
        });
      }
    }

    db.Tickets.Add(ticket);
    try
    {
      await db.SaveChangesAsync(cancellationToken);

      // Broadcast to tenant and ticket groups — send lightweight DTOs and guard SendAsync with try/catch and log on failure
      var ticketDto = new TicketDto(
        ticket.Id,
        ticket.TenantId,
        ticket.Title,
        ticket.Description,
        ticket.Status,
        ticket.Priority,
        ticket.AssigneeId,
        ticket.Assignee?.Name,
        ticket.RequesterId,
        ticket.Requester?.Name,
        ticket.TeamId,
        ticket.Tags,
        ticket.SlaDueAt,
        ticket.SlaBreached,
        ticket.CreatedAt,
        ticket.UpdatedAt,
        ticket.Attachments.Select(a => new AttachmentDto(a.Id, a.FileName, a.Url, a.UploadedAt)).ToList()
      );

      var broadcastId = Guid.NewGuid().ToString();
      try
      {
        _ = hub.Clients.Group($"tenant:{tenantId}").SendAsync("TicketCreated",
          new TicketCreatedEvent(broadcastId, tenantId, ticketDto), cancellationToken: cancellationToken);
      }
      catch (Exception ex)
      {
        logger.LogError(ex, "SignalR SendAsync error when sending TicketCreated to tenant:{TenantId}", tenantId);
      }

      try
      {
        _ = hub.Clients.Group($"ticket:{ticket.Id}").SendAsync("TicketCreated",
          new TicketCreatedEvent(broadcastId, tenantId, ticketDto), cancellationToken: cancellationToken);
      }
      catch (Exception ex)
      {
        logger.LogError(ex, "SignalR SendAsync error when sending TicketCreated to ticket:{TicketId}", ticket.Id);
      }
    }
    catch (DbUpdateException ex)
    {
      // Hot Chocolate may otherwise map unexpected DB exceptions to a generic "Unexpected Execution Error".
      logger.LogError(ex, "Database error while creating ticket for tenant:{TenantId}", tenantId);
      throw new GraphQLException($"Failed to create ticket due to a database error: {ex.GetBaseException().Message}");
    }

    return ticket;
  }

  public async Task<Ticket> UpdateTicket(
    [ID] string id,
    UpdateTicketInput input,
    [Service] AppDbContext db,
    [Service] ICurrentUserContext ctx,
    [Service] IHubContext<TicketHub> hub,
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
    if (input.Tags is not null)
      ticket.Tags = input.Tags.Where(tag => !string.IsNullOrWhiteSpace(tag)).Select(tag => tag.Trim())
        .Distinct(StringComparer.OrdinalIgnoreCase).ToList();
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

    // Notify listeners about the update
    // Load latest ticket for payload
    var updated = await db.Tickets
      .Include(x => x.Assignee)
      .Include(x => x.Requester)
      .Include(x => x.Team)
      .Include(x => x.Comments).ThenInclude(x => x.Author)
      .Include(x => x.History)
      .Include(x => x.Attachments)
      .FirstAsync(x => x.Id == id && x.TenantId == tenantId, cancellationToken);

    // Map updated ticket to DTO before broadcasting
    var updatedDto = new TicketDto(
      updated.Id,
      updated.TenantId,
      updated.Title,
      updated.Description,
      updated.Status,
      updated.Priority,
      updated.AssigneeId,
      updated.Assignee?.Name,
      updated.RequesterId,
      updated.Requester?.Name,
      updated.TeamId,
      updated.Tags,
      updated.SlaDueAt,
      updated.SlaBreached,
      updated.CreatedAt,
      updated.UpdatedAt,
      updated.Attachments.Select(a => new AttachmentDto(a.Id, a.FileName, a.Url, a.UploadedAt)).ToList()
    );

    var updateBroadcastId = Guid.NewGuid().ToString();

    // Decide whether to send tenant-wide update depending on input fields that dashboards care about
    // Notify tenant dashboards when status, priority, assignee or team change
    var shouldNotifyTenant = input.Status is not null || input.Priority is not null || input.Tags is not null;
    // Note: UpdateTicketInput currently doesn't include AssigneeId or TeamId in the schema,
    // so we consider Tags as a proxy for some changes; if you add assignee/team to UpdateTicketInput,
    // include checks here (e.g., input.AssigneeId is not null || input.TeamId is not null)

    try
    {
      if (shouldNotifyTenant)
      {
        _ = hub.Clients.Group($"tenant:{tenantId}").SendAsync("TicketUpdated",
          new TicketUpdatedEvent(updateBroadcastId, tenantId, updatedDto), cancellationToken: cancellationToken);
      }
    }
    catch (Exception ex)
    {
      logger.LogError(ex, "SignalR SendAsync error when sending TicketUpdated to tenant:{TenantId}", tenantId);
    }

    try
    {
      _ = hub.Clients.Group($"ticket:{id}").SendAsync("TicketUpdated",
        new TicketUpdatedEvent(updateBroadcastId, tenantId, updatedDto), cancellationToken: cancellationToken);
    }
    catch (Exception ex)
    {
      logger.LogError(ex, "SignalR SendAsync error when sending TicketUpdated to ticket:{TicketId}", id);
    }

    return updated;
  }

  public async Task<Ticket> AssignTicket(
    [ID] string id,
    [ID] string assigneeId,
    [Service] AppDbContext db,
    [Service] ICurrentUserContext ctx,
    [Service] IHubContext<TicketHub> hub,
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

    var result = await db.Tickets
      .Include(x => x.Assignee)
      .FirstAsync(x => x.Id == id && x.TenantId == tenantId, cancellationToken);

    var assignBroadcastId = Guid.NewGuid().ToString();
    try
    {
      _ = hub.Clients.Group($"tenant:{tenantId}").SendAsync("TicketAssigned",
        new TicketAssignedEvent(assignBroadcastId, tenantId, id, user.Id));
    }
    catch (Exception ex)
    {
      logger.LogError(ex, "SignalR SendAsync error when sending TicketAssigned to tenant:{TenantId}", tenantId);
    }

    try
    {
      _ = hub.Clients.Group($"ticket:{id}").SendAsync("TicketAssigned",
        new TicketAssignedEvent(assignBroadcastId, tenantId, id, user.Id));
    }
    catch (Exception ex)
    {
      logger.LogError(ex, "SignalR SendAsync error when sending TicketAssigned to ticket:{TicketId}", id);
    }

    return result;
  }

  public async Task<Comment> AddComment(
    [ID] string ticketId,
    string body,
    [Service] AppDbContext db,
    [Service] ICurrentUserContext ctx,
    [Service] IHubContext<TicketHub> hub,
    CancellationToken cancellationToken)
  {
    var tenantId = TenantScopeGuard.RequireTenantId(ctx);
    var userId = TenantScopeGuard.RequireUserId(ctx);
    var ticket =
      await db.Tickets.FirstOrDefaultAsync(x => x.Id == ticketId && x.TenantId == tenantId, cancellationToken)
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

    var saved = await db.Comments.Include(x => x.Author).FirstAsync(x => x.Id == comment.Id, cancellationToken);

    // Build a lightweight DTO to send over SignalR to avoid serializing EF entities with navigation cycles
    var commentDto = new CommentDto(
      saved.Id,
      saved.TenantId,
      saved.TicketId,
      saved.AuthorId,
      saved.Author?.Name ?? "",
      saved.Body,
      saved.CreatedAt);

    var commentBroadcastId = Guid.NewGuid().ToString();
    try
    {
      logger.LogInformation("Broadcasting CommentAdded id:{CommentId} to ticket:{TicketId}", commentDto.Id, ticketId);
      // CommentAdded is ticket-scoped only — tenant-level listeners don't need comment bodies
      _ = hub.Clients.Group($"ticket:{ticketId}").SendAsync("CommentAdded",
        new CommentAddedEvent(commentBroadcastId, tenantId, ticketId, commentDto));
    }
    catch (Exception ex)
    {
      logger.LogError(ex, "SignalR SendAsync error when sending CommentAdded to ticket:{TicketId}", ticketId);
    }

    return saved;
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

  private static async Task<string> NextTicketId(AppDbContext db, CancellationToken cancellationToken)
  {
    // Ticket.Id is a global primary key (not tenant-scoped), so the numeric sequence must be global
    // to avoid collisions when multiple tenants exist.
    var ids = await db.Tickets
      .AsNoTracking()
      .Select(x => x.Id)
      .ToListAsync(cancellationToken);

    var next = ids
      .Select(id => id.StartsWith("t-") && int.TryParse(id[2..], out var parsed) ? parsed : 0)
      .DefaultIfEmpty(0)
      .Max() + 1;
    return $"t-{next}";
  }
}
