using AiIncident.Api.Models;

namespace AiIncident.Api.GraphQL;

public sealed record PageInfo(string? EndCursor, bool HasNextPage);

public sealed record TicketEdge(string Cursor, Ticket Node);

public sealed record TicketConnection(IReadOnlyList<TicketEdge> Edges, PageInfo PageInfo);

public sealed record TeamWorkload(string TeamId, string TeamName, int OpenTickets);

public sealed record DashboardMetrics(
    int OpenCount,
    int ResolvedCount,
    int SlaBreaches,
    int AgingOver7d,
    IReadOnlyList<TeamWorkload> ByTeam
);

public sealed class TicketFilterInput
{
    public List<TicketStatus>? Status { get; set; }
    public List<TicketPriority>? Priority { get; set; }
    public string? AssigneeId { get; set; }
    public List<string>? Tags { get; set; }
    public bool? SlaBreaching { get; set; }
    public string? Search { get; set; }
}

public sealed class CreateTicketInput
{
    public string Title { get; set; } = default!;
    public string Description { get; set; } = default!;
    public TicketPriority Priority { get; set; }
    public string Category { get; set; } = default!;
    public List<string>? Tags { get; set; }
    public List<string>? AttachmentIds { get; set; }
}

public sealed class UpdateTicketInput
{
    public TicketStatus? Status { get; set; }
    public TicketPriority? Priority { get; set; }
    public string? Title { get; set; }
    public string? Description { get; set; }
    public string? Category { get; set; }
    public List<string>? Tags { get; set; }
}
