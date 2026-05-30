using AiIncident.Api.Models;

namespace AiIncident.Api.GraphQL;

// Lightweight DTOs for SignalR events to avoid serializing EF tracked entities
public sealed record AttachmentDto(string Id, string FileName, string Url, DateTime UploadedAt);

public sealed record TicketDto(
  string Id,
  string TenantId,
  string Title,
  string Description,
  TicketStatus Status,
  TicketPriority Priority,
  string? AssigneeId,
  string? AssigneeName,
  string RequesterId,
  string? RequesterName,
  string? TeamId,
  List<string> Tags,
  DateTime? SlaDueAt,
  bool SlaBreached,
  DateTime CreatedAt,
  DateTime UpdatedAt,
  List<AttachmentDto> Attachments
);

public sealed record TicketCreatedEvent(string BroadcastId, string TenantId, TicketDto Ticket);

public sealed record AssigneeDto(string Id, string? Name);

public sealed record TicketUpdatedEvent(string BroadcastId, string TenantId, TicketDto Ticket);

public sealed record TicketAssignedEvent(
  string BroadcastId,
  string TenantId,
  string TicketId,
  AssigneeDto Assignee,
  DateTime UpdatedAt);

public sealed record CommentDto(
  string Id,
  string TenantId,
  string TicketId,
  string AuthorId,
  string AuthorName,
  string Body,
  DateTime CreatedAt);

public sealed record CommentAddedEvent(string BroadcastId, string TenantId, string TicketId, CommentDto Comment);
