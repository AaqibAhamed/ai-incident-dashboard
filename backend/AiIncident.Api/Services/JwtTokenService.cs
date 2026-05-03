using AiIncident.Api.Models;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace AiIncident.Api.Services;

public interface IJwtTokenService
{
    string CreateAccessToken(User user, string? tenantSlug);
    string CreateRefreshToken();
}

public sealed class JwtTokenService(IConfiguration configuration) : IJwtTokenService
{
    public string CreateAccessToken(User user, string? tenantSlug)
    {
        var issuer = configuration["Jwt:Issuer"] ?? "ai-incident-api";
        var audience = configuration["Jwt:Audience"] ?? "ai-incident-dashboard-spa";
        var signingKey = configuration["Jwt:SigningKey"] ?? "dev-only-signing-key-change-me";
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new(ClaimTypes.Role, user.Role.ToString()),
            new("name", user.Name)
        };

        if (!string.IsNullOrEmpty(user.TenantId))
        {
            claims.Add(new Claim("tenant_id", user.TenantId));
        }

        if (!string.IsNullOrEmpty(tenantSlug))
        {
            claims.Add(new Claim("tenant_slug", tenantSlug));
        }

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(30),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string CreateRefreshToken() => $"refresh-{Guid.NewGuid():N}";
}

public interface IRefreshTokenStore
{
    void Save(string refreshToken, string userId);
    bool TryGetUser(string refreshToken, out string userId);
}
