using AiIncident.Api.Services;

namespace AiIncident.Api.GraphQL;

public static class TenantScopeGuard
{
    /// <summary>
    /// GraphQL ticket API is for tenant-scoped product users only.
    /// </summary>
    public static string RequireTenantId(ICurrentUserContext ctx)
    {
        if (ctx.IsSuperAdmin)
        {
            throw new GraphQLException(
                "Platform administrators manage tenants via /api/platform. The ticket API is not available for this account.");
        }

        if (string.IsNullOrEmpty(ctx.TenantId))
        {
            throw new GraphQLException("Missing tenant context. Sign in as a tenant user.");
        }

        return ctx.TenantId;
    }

    public static string RequireUserId(ICurrentUserContext ctx)
    {
        if (string.IsNullOrEmpty(ctx.UserId))
        {
            throw new GraphQLException("Not authenticated.");
        }

        return ctx.UserId;
    }
}
