SignalRService

- Provided at root. Call `signalRService.start()` after login to establish connection.
- Service joins tenant group automatically using tenant from `AuthStore`.
- Components can call `signalRService.joinTicket(ticketId)` to receive ticket-level events.
- Facades (e.g., `TicketsFacade`) subscribe to service signals to update local stores.

Events exposed as signals:

- lastTicketCreated
- lastTicketUpdated
- lastTicketAssigned
- lastCommentAdded
