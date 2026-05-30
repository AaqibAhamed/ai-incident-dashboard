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

- Refactor Mutation class to improve ticket creation and update processes, including better error handling and broadcasting events.
- Introduce TicketDto for lightweight data transfer during SignalR events.
- Update TicketHub to streamline tenant claim retrieval and improve error logging.
- Enhance SignalRService to prevent duplicate broadcasts across tabs and optimize event handling.
- Modify TicketsFacade to handle new event structures and improve local state updates for comments.
- Update TicketDetailPage to optimistically patch comments and handle SignalR events more effectively.
