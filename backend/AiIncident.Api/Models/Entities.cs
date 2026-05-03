using System.Text.Json.Serialization;
using HotChocolate;

namespace AiIncident.Api.Models;

public sealed class Tenant
{
    public string Id { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string Slug { get; set; } = default!;
    public TenantStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<TenantEmailDomain> EmailDomains { get; set; } = [];
    public List<User> Users { get; set; } = [];
}

public sealed class TenantEmailDomain
{
    public string Domain { get; set; } = default!;
    public string TenantId { get; set; } = default!;
    public Tenant? Tenant { get; set; }
    public bool IsPrimary { get; set; }
}

public sealed class User
{
    public string Id { get; set; } = default!;

    [GraphQLIgnore]
    public string? TenantId { get; set; }

    [GraphQLIgnore]
    public Tenant? Tenant { get; set; }
    public string Name { get; set; } = default!;
    public string Email { get; set; } = default!;
    public UserRole Role { get; set; }

    [JsonIgnore]
    [GraphQLIgnore]
    public string PasswordHash { get; set; } = default!;

    public bool IsActive { get; set; } = true;
}

public sealed class Team
{
    public string Id { get; set; } = default!;
    public string TenantId { get; set; } = default!;
    public Tenant? Tenant { get; set; }
    public string Name { get; set; } = default!;
}

public sealed class Ticket
{
    public string Id { get; set; } = default!;
    public string TenantId { get; set; } = default!;
    public Tenant? Tenant { get; set; }
    public string Title { get; set; } = default!;
    public string Description { get; set; } = default!;
    public TicketStatus Status { get; set; }
    public TicketPriority Priority { get; set; }
    public string? AssigneeId { get; set; }
    public User? Assignee { get; set; }
    public string RequesterId { get; set; } = default!;
    public User? Requester { get; set; }
    public string? TeamId { get; set; }
    public Team? Team { get; set; }
    public string? Category { get; set; }
    public List<string> Tags { get; set; } = [];
    public DateTime? SlaDueAt { get; set; }
    public bool SlaBreached { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<string> RelatedTicketIds { get; set; } = [];
    public List<Comment> Comments { get; set; } = [];
    public List<TicketHistoryEntry> History { get; set; } = [];
    public List<Attachment> Attachments { get; set; } = [];
}

public sealed class Comment
{
    public string Id { get; set; } = default!;
    public string TenantId { get; set; } = default!;
    public string TicketId { get; set; } = default!;
    public Ticket? Ticket { get; set; }
    public string AuthorId { get; set; } = default!;
    public User? Author { get; set; }
    public string Body { get; set; } = default!;
    public DateTime CreatedAt { get; set; }
}

public sealed class TicketHistoryEntry
{
    public string Id { get; set; } = default!;
    public string TenantId { get; set; } = default!;
    public string TicketId { get; set; } = default!;
    public Ticket? Ticket { get; set; }
    public DateTime CreatedAt { get; set; }
    public string Action { get; set; } = default!;
    public string? Details { get; set; }
}

public sealed class Attachment
{
    public string Id { get; set; } = default!;
    public string TenantId { get; set; } = default!;
    public string TicketId { get; set; } = default!;
    public Ticket? Ticket { get; set; }
    public string FileName { get; set; } = default!;
    public string Url { get; set; } = default!;
    public DateTime UploadedAt { get; set; }
}

public sealed class MediaAsset
{
    public string Id { get; set; } = default!;
    public string TenantId { get; set; } = default!;
    public string OriginalFileName { get; set; } = default!;
    public string StoredFileName { get; set; } = default!;
    public string ContentType { get; set; } = default!;
    public long SizeBytes { get; set; }
    public string Url { get; set; } = default!;
    public string UploadedByUserId { get; set; } = default!;
    public User? UploadedByUser { get; set; }
    public DateTime UploadedAt { get; set; }
}

public sealed class RefreshTokenRecord
{
    public string Token { get; set; } = default!;
    public string UserId { get; set; } = default!;
    public User? User { get; set; }
    public DateTime ExpiresAt { get; set; }
}
