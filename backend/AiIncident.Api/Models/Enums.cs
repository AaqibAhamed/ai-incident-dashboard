namespace AiIncident.Api.Models;

public enum TicketStatus
{
    OPEN,
    IN_PROGRESS,
    RESOLVED,
    CLOSED
}

public enum TicketPriority
{
    P1,
    P2,
    P3,
    P4
}

public enum UserRole
{
    SUPER_ADMIN,
    TENANT_ADMIN,
    MANAGER,
    AGENT,
    REQUESTER
}

public enum TenantStatus
{
    Active,
    Suspended
}
