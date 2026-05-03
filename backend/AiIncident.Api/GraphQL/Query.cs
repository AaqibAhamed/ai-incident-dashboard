using AiIncident.Api.Data;
using AiIncident.Api.Models;
using AiIncident.Api.Services;
using Microsoft.EntityFrameworkCore;
using System.Text;

namespace AiIncident.Api.GraphQL;

public sealed class Query
{
    public async Task<MePayload?> Me(
        [Service] AppDbContext db,
        [Service] ICurrentUserContext ctx,
        CancellationToken cancellationToken)
    {
        if (!ctx.IsAuthenticated || string.IsNullOrEmpty(ctx.UserId))
        {
            return null;
        }

        var user = await db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == ctx.UserId, cancellationToken);
        if (user is null)
        {
            return null;
        }

        TenantGql? tenantGql = null;
        if (user.TenantId is not null)
        {
            var tenant = await db.Tenants.AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == user.TenantId, cancellationToken);
            if (tenant is not null)
            {
                tenantGql = new TenantGql
                {
                    Id = tenant.Id,
                    Name = tenant.Name,
                    Slug = tenant.Slug,
                    Status = tenant.Status
                };
            }
        }

        return new MePayload { User = user, Tenant = tenantGql };
    }

    public async Task<TicketConnection> Tickets(
        TicketFilterInput? filter,
        string? after,
        int? first,
        [Service] AppDbContext db,
        [Service] ICurrentUserContext ctx,
        CancellationToken cancellationToken)
    {
        var tenantId = TenantScopeGuard.RequireTenantId(ctx);
        var pageSize = first is > 0 ? first.Value : 15;
        var query = db.Tickets
            .AsNoTracking()
            .Where(t => t.TenantId == tenantId)
            .Include(x => x.Assignee)
            .Include(x => x.Team)
            .OrderByDescending(x => x.CreatedAt)
            .AsQueryable();

        query = ApplyFilter(query, filter);
        var items = await query.ToListAsync(cancellationToken);

        var start = DecodeCursor(after) + 1;
        if (start < 0) start = 0;

        var slice = items.Skip(start).Take(pageSize).ToList();
        var edges = slice.Select((ticket, index) =>
            new TicketEdge(EncodeCursor(start + index), ticket)).ToList();
        var hasNextPage = start + pageSize < items.Count;
        var endCursor = edges.Count > 0 ? edges[^1].Cursor : null;

        return new TicketConnection(edges, new PageInfo(endCursor, hasNextPage));
    }

    public async Task<Ticket?> Ticket(
        [ID] string id,
        [Service] AppDbContext db,
        [Service] ICurrentUserContext ctx,
        CancellationToken cancellationToken)
    {
        var tenantId = TenantScopeGuard.RequireTenantId(ctx);
        return await db.Tickets
            .AsNoTracking()
            .Where(t => t.TenantId == tenantId && t.Id == id)
            .Include(x => x.Assignee)
            .Include(x => x.Requester)
            .Include(x => x.Team)
            .Include(x => x.Comments).ThenInclude(x => x.Author)
            .Include(x => x.History)
            .Include(x => x.Attachments)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<DashboardMetrics> DashboardMetrics(
        string range,
        [Service] AppDbContext db,
        [Service] ICurrentUserContext ctx,
        CancellationToken cancellationToken)
    {
        var tenantId = TenantScopeGuard.RequireTenantId(ctx);
        var tickets = await db.Tickets.AsNoTracking()
            .Where(t => t.TenantId == tenantId)
            .Include(x => x.Team)
            .ToListAsync(cancellationToken);
        _ = range;

        var openCount = tickets.Count(x => x.Status is TicketStatus.OPEN or TicketStatus.IN_PROGRESS);
        var resolvedCount = tickets.Count(x => x.Status is TicketStatus.RESOLVED or TicketStatus.CLOSED);
        var slaBreaches = tickets.Count(x => x.SlaBreached);
        var agingOver7d = tickets.Count(x =>
            x.CreatedAt < DateTime.UtcNow.AddDays(-7) && x.Status != TicketStatus.CLOSED);

        var byTeam = tickets
            .Where(x => x.Team is not null)
            .GroupBy(x => new { x.TeamId, TeamName = x.Team!.Name })
            .Select(g => new TeamWorkload(
                g.Key.TeamId!,
                g.Key.TeamName,
                g.Count(t => t.Status != TicketStatus.CLOSED)))
            .OrderBy(x => x.TeamName)
            .ToList();

        return new DashboardMetrics(openCount, resolvedCount, slaBreaches, agingOver7d, byTeam);
    }

    private static IQueryable<Ticket> ApplyFilter(IQueryable<Ticket> query, TicketFilterInput? filter)
    {
        if (filter is null) return query;
        if (filter.Status is { Count: > 0 })
            query = query.Where(x => filter.Status.Contains(x.Status));
        if (filter.Priority is { Count: > 0 })
            query = query.Where(x => filter.Priority.Contains(x.Priority));
        if (!string.IsNullOrWhiteSpace(filter.AssigneeId))
            query = query.Where(x => x.AssigneeId == filter.AssigneeId);
        if (filter.Tags is { Count: > 0 })
            query = query.Where(x => x.Tags.Any(tag => filter.Tags.Contains(tag)));
        if (filter.SlaBreaching is true)
            query = query.Where(x => x.SlaBreached);
        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var search = filter.Search.Trim().ToLowerInvariant();
            query = query.Where(x =>
                x.Title.ToLower().Contains(search) ||
                x.Description.ToLower().Contains(search));
        }
        return query;
    }

    private static string EncodeCursor(int index) =>
        Convert.ToBase64String(Encoding.UTF8.GetBytes($"c:{index}"));

    private static int DecodeCursor(string? cursor)
    {
        if (string.IsNullOrWhiteSpace(cursor)) return -1;
        try
        {
            var decoded = Encoding.UTF8.GetString(Convert.FromBase64String(cursor));
            var parts = decoded.Split(':', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length == 2 && int.TryParse(parts[1], out var result))
            {
                return result;
            }
        }
        catch
        {
            // keep default
        }
        return -1;
    }
}
