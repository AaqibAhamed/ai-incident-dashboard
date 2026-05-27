using AiIncident.Api.Models;

namespace AiIncident.Api.GraphQL;

public sealed record TicketCreatedEvent(string TenantId, Ticket Ticket);

public sealed record TicketUpdatedEvent(string TenantId, Ticket Ticket);

public sealed record TicketAssignedEvent(string TenantId, string TicketId, string AssigneeId);

// Use lightweight DTOs for SignalR events to avoid serializing EF tracked entities
public sealed record CommentDto(string Id, string TenantId, string TicketId, string AuthorId, string AuthorName, string Body, DateTime CreatedAt);

public sealed record CommentAddedEvent(string TenantId, string TicketId, CommentDto Comment);
