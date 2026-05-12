using AiIncident.Api.GraphQL;
using AiIncident.Api.Models;
using AiIncident.Api.Services;
using HotChocolate;
using Xunit;

namespace AiIncident.Api.Tests;

public class TenantScopeGuardTests
{
    private sealed class StubCtx : ICurrentUserContext
    {
        public string UserId => "u1";
        public string? TenantId { get; init; }
        public string TenantSlug => "demo";
        public UserRole? Role { get; init; }
        public bool IsSuperAdmin => Role == UserRole.SUPER_ADMIN;
        public bool IsAuthenticated => true;
    }

    [Fact]
    public void RequireTenantId_rejects_super_admin()
    {
        var ctx = new StubCtx { Role = UserRole.SUPER_ADMIN, TenantId = null };
        Assert.Throws<GraphQLException>(() => TenantScopeGuard.RequireTenantId(ctx));
    }

    [Fact]
    public void RequireTenantId_returns_tenant_for_manager()
    {
        var ctx = new StubCtx { Role = UserRole.MANAGER, TenantId = "tenant-a" };
        Assert.Equal("tenant-a", TenantScopeGuard.RequireTenantId(ctx));
    }

    [Fact]
    public void RequireTenantId_throws_when_tenant_missing_for_non_super()
    {
        var ctx = new StubCtx { Role = UserRole.AGENT, TenantId = null };
        Assert.Throws<GraphQLException>(() => TenantScopeGuard.RequireTenantId(ctx));
    }
}
