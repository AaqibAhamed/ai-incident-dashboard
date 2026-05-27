using AiIncident.Api.GraphQL;
using Microsoft.Extensions.Logging;
using System.Security.Claims;
using Xunit;

namespace AiIncident.Api.Tests;

public class TicketHubTests
{
    private static ClaimsPrincipal MakeUser(string? tenantId)
    {
        var claims = new List<Claim>();
        if (tenantId != null)
        {
            claims.Add(new Claim("tenant_id", tenantId));
        }

        var identity = new ClaimsIdentity(claims, "test");
        return new ClaimsPrincipal(identity);
    }

    private sealed class NullLogger<T> : ILogger<T>
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => false;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) { }
    }

    [Fact]
    public void TenantClaimMatches_returns_true_on_match()
    {
        var user = MakeUser("tenant-1");

        Assert.True(TicketHub.TenantClaimMatches(user, "tenant-1"));
    }

    [Fact]
    public void TenantClaimMatches_returns_false_when_missing()
    {
        var user = MakeUser(null);

        Assert.False(TicketHub.TenantClaimMatches(user, "tenant-1"));
    }

    [Fact]
    public async Task CanJoinTicket_returns_false_when_ticket_missing()
    {
        var user = MakeUser("tenant-a");

        var logger = new NullLogger<object>();

        // ticketExistsChecker returns false
        var result = await TicketHub.CanJoinTicket(user, "t1", (ticketId, tenantId) => Task.FromResult(false), logger as ILogger);

        Assert.False(result);
    }

    [Fact]
    public async Task CanJoinTicket_returns_true_when_exists()
    {
        var user = MakeUser("tenant-a");

        var logger = new NullLogger<object>();

        var result = await TicketHub.CanJoinTicket(user, "t1", (ticketId, tenantId) => Task.FromResult(true), logger as ILogger);

        Assert.True(result);
    }

    [Fact]
    public async Task CanJoinTicket_rejects_when_no_tenant_claim()
    {
        var user = MakeUser(null);

        var logger = new NullLogger<object>();

        var result = await TicketHub.CanJoinTicket(user, "t1", (ticketId, tenantId) => Task.FromResult(true), logger as ILogger);

        Assert.False(result);
    }
}
