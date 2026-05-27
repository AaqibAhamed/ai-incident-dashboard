using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace AiIncident.Api.GraphQL;

[Authorize]
public sealed class TicketHub : Hub
{
    // Clients should join tenant groups and optionally ticket-specific groups to receive updates.
    public Task JoinTenant(string tenantId)
    {
        var userTenant = Context.User?.FindFirst("tenant_id")?.Value;
        if (userTenant is null || userTenant != tenantId)
        {
            // Prevent joining other tenant groups
            throw new HubException("Forbidden");
        }
        return Groups.AddToGroupAsync(Context.ConnectionId, $"tenant:{tenantId}");
    }

    public Task JoinTicket(string ticketId)
    {
        // Optionally, you could validate ticket belongs to tenant using a DB lookup; for now rely on tenant group membership.
        return Groups.AddToGroupAsync(Context.ConnectionId, $"ticket:{ticketId}");
    }

    public Task LeaveTicket(string ticketId)
    {
        return Groups.RemoveFromGroupAsync(Context.ConnectionId, $"ticket:{ticketId}");
    }
}
