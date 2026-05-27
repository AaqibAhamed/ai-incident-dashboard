using AiIncident.Api.Data;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace AiIncident.Api.GraphQL;

[Authorize]
public sealed class TicketHub(
  ILogger<TicketHub> logger,
  AppDbContext db
) : Hub
{
  // public async Task JoinTicket(string ticketId)
  // {
  //     try
  //     {
  //       if (string.IsNullOrWhiteSpace(ticketId))
  //       {
  //         return;
  //       }

  //       // var tenantId = TenantScopeGuard.RequireTenantId(_ctx);

  //       var tenantId = Context.User?.FindFirst("tenantId")?.Value;

  //       var exists = await _db.Tickets.AnyAsync(
  //         x => x.Id == ticketId &&
  //              x.TenantId == tenantId
  //       );

  //       if (!exists)
  //       {
  //         _logger.LogWarning(
  //           "JoinTicket denied. Ticket not found. Ticket:{TicketId}",
  //           ticketId
  //         );

  //         return;
  //       }

  //       await Groups.AddToGroupAsync(
  //         Context.ConnectionId,
  //         $"ticket:{ticketId}"
  //       );

  //       _logger.LogInformation(
  //         "Connection {ConnectionId} joined ticket:{TicketId}",
  //         Context.ConnectionId,
  //         ticketId
  //       );
  //     }
  //     catch (Exception ex)
  //     {
  //         _logger.LogError(
  //             ex,
  //             "Error joining ticket group {TicketId}",
  //             ticketId
  //         );

  //         // NEVER rethrow
  //     }
  // }

  public async Task JoinTicket(string ticketId)
  {
    try
    {
      if (string.IsNullOrWhiteSpace(ticketId))
      {
        return;
      }

      var tenantId = Context.User?
        .FindFirst("tenantId")
        ?.Value;

      if (string.IsNullOrWhiteSpace(tenantId))
      {
        logger.LogWarning(
          "JoinTicket denied. Missing tenant claim."
        );

        return;
      }

      var exists = await db.Tickets.AnyAsync(x => x.Id == ticketId &&
                                                  x.TenantId == tenantId
      );

      if (!exists)
      {
        logger.LogWarning(
          "JoinTicket denied. Ticket not found. Ticket:{TicketId}",
          ticketId
        );

        return;
      }

      await Groups.AddToGroupAsync(
        Context.ConnectionId,
        $"ticket:{ticketId}"
      );

      logger.LogInformation(
        "Connection {ConnectionId} joined ticket:{TicketId}",
        Context.ConnectionId,
        ticketId
      );
    }
    catch (Exception ex)
    {
      logger.LogError(
        ex,
        "Error joining ticket group {TicketId}",
        ticketId
      );
    }
  }

  public async Task LeaveTicket(string ticketId)
  {
    try
    {
      if (string.IsNullOrWhiteSpace(ticketId))
      {
        return;
      }

      await Groups.RemoveFromGroupAsync(
        Context.ConnectionId,
        $"ticket:{ticketId}"
      );
    }
    catch (Exception ex)
    {
      logger.LogError(
        ex,
        "Error leaving ticket group {TicketId}",
        ticketId
      );
    }
  }

  public async Task JoinTenant(string tenantId)
  {
    try
    {
      if (string.IsNullOrWhiteSpace(tenantId))
      {
        return;
      }

      var tenantClaim = Context.User?
        .FindFirst("tenantId")
        ?.Value;

      if (string.IsNullOrWhiteSpace(tenantClaim) || tenantClaim != tenantId)
      {
        logger.LogWarning(
          "JoinTenant denied. Missing or mismatched tenant claim. Expected:{ExpectedTenant} Actual:{ActualTenant}",
          tenantId,
          tenantClaim
        );

        return;
      }

      await Groups.AddToGroupAsync(Context.ConnectionId, $"tenant:{tenantId}");

      logger.LogInformation(
        "Connection {ConnectionId} joined tenant:{TenantId}",
        Context.ConnectionId,
        tenantId
      );
    }
    catch (Exception ex)
    {
      logger.LogError(
        ex,
        "Error joining tenant group {TenantId}",
        tenantId
      );
    }
  }

  public async Task LeaveTenant(string tenantId)
  {
    try
    {
      if (string.IsNullOrWhiteSpace(tenantId))
      {
        return;
      }

      await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"tenant:{tenantId}");
    }
    catch (Exception ex)
    {
      logger.LogError(
        ex,
        "Error leaving tenant group {TenantId}",
        tenantId
      );
    }
  }


  // Internal helpers exposed to tests
  public static bool TenantClaimMatches(ClaimsPrincipal? user, string tenantId)
  {
    var claim = user?.FindFirst("tenantId")?.Value;

    return !string.IsNullOrWhiteSpace(claim) && string.Equals(claim, tenantId, StringComparison.Ordinal);
  }

  public static async Task<bool> CanJoinTicket(ClaimsPrincipal? user, string ticketId, Func<string, string, Task<bool>> ticketExistsChecker, ILogger logger)
  {
    if (string.IsNullOrWhiteSpace(ticketId))
    {
      return false;
    }

    var tenantId = user?.FindFirst("tenantId")?.Value;

    if (string.IsNullOrWhiteSpace(tenantId))
    {
      logger.LogWarning("JoinTicket denied. Missing tenant claim.");

      return false;
    }

    try
    {
      var exists = await ticketExistsChecker(ticketId, tenantId);

      if (exists) return true;
      logger.LogWarning("JoinTicket denied. Ticket not found. Ticket:{TicketId}", ticketId);

      return false;

    }
    catch (Exception ex)
    {
      logger.LogError(ex, "Error checking ticket existence {TicketId}", ticketId);

      return false;
    }
  }
}