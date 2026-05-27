# SignalR Real-time Notes

This project includes a minimal SignalR hub for ticket real-time updates.

Endpoints

- Hub: /hubs/tickets (maps to TicketHub)

Groups

- tenant:{tenantId} - clients in the same tenant should join this group to receive tenant-wide events.
- ticket:{ticketId} - clients can join a specific ticket group to receive ticket-scoped events.

Server-side events (broadcasted from GraphQL mutations)

- TicketCreated
- TicketUpdated
- TicketAssigned
- CommentAdded

Enabling Redis backplane

- To enable a Redis backplane for scaling across multiple instances, add the package:
  Microsoft.AspNetCore.SignalR.StackExchangeRedis
- Then in Program.cs call:
  builder.Services.AddSignalR().AddStackExchangeRedis("<connection-string>");

Security

- The hub requires authorization. The client must send a valid JWT with tenant claims.
- TicketHub.JoinTenant enforces that the tenant claim on the token matches the requested tenant group.
