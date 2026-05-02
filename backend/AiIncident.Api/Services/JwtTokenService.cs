using AiIncident.Api.Models;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace AiIncident.Api.Services;

public interface IJwtTokenService
{
    string CreateAccessToken(User user);
    string CreateRefreshToken();
}

public sealed class JwtTokenService(IConfiguration configuration) : IJwtTokenService
{
    public string CreateAccessToken(User user)
    {
        var issuer = configuration["Jwt:Issuer"] ?? "AiIncident.Api";
        var audience = configuration["Jwt:Audience"] ?? "AiIncident.Frontend";
        var signingKey = configuration["Jwt:SigningKey"] ?? "dev-only-signing-key-change-me";
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim("name", user.Name)
        };

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

public sealed class InMemoryRefreshTokenStore : IRefreshTokenStore
{
    private readonly Dictionary<string, string> _tokens = new(StringComparer.Ordinal);

    public void Save(string refreshToken, string userId) => _tokens[refreshToken] = userId;

    public bool TryGetUser(string refreshToken, out string userId) =>
        _tokens.TryGetValue(refreshToken, out userId!);
}
