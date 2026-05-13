using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using AiIncident.Api.Models;

namespace AiIncident.Api.Services;

public interface ICurrentUserContext
{
    string? UserId { get; }
    string? TenantId { get; }
    string? TenantSlug { get; }
    UserRole? Role { get; }
    bool IsSuperAdmin { get; }
    bool IsAuthenticated { get; }
}

public sealed class CurrentUserContext(IHttpContextAccessor httpContextAccessor) : ICurrentUserContext
{
    private ClaimsPrincipal? Principal => httpContextAccessor.HttpContext?.User;

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated == true;

    public string? UserId =>
        Principal?.FindFirstValue(JwtRegisteredClaimNames.Sub)
        ?? Principal?.FindFirstValue(ClaimTypes.NameIdentifier);

    public string? TenantId => Principal?.FindFirstValue("tenant_id");

    public string? TenantSlug => Principal?.FindFirstValue("tenant_slug");

    public UserRole? Role
    {
        get
        {
            var r = Principal?.FindFirstValue(ClaimTypes.Role);
            return Enum.TryParse<UserRole>(r, ignoreCase: true, out var parsed) ? parsed : null;
        }
    }

    public bool IsSuperAdmin => Role == UserRole.SUPER_ADMIN;
}
