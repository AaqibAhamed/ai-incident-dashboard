using AiIncident.Api.Data;
using AiIncident.Api.Models;
using AiIncident.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AiIncident.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(
    AppDbContext db,
    IJwtTokenService jwtTokenService,
    IRefreshTokenStore refreshTokenStore) : ControllerBase
{
    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        var template = await db.Users.FirstOrDefaultAsync(x => x.Role == request.Role, cancellationToken)
            ?? await db.Users.FirstAsync(cancellationToken);

        var user = new User
        {
            Id = template.Id,
            Name = template.Name,
            Email = string.IsNullOrWhiteSpace(request.Email) ? template.Email : request.Email.Trim(),
            Role = request.Role
        };

        var response = CreateAuthResponse(user);
        return Ok(response);
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<AuthResponse>> Refresh([FromBody] RefreshRequest request, CancellationToken cancellationToken)
    {
        if (!refreshTokenStore.TryGetUser(request.RefreshToken, out var userId))
        {
            return Unauthorized();
        }

        var user = await db.Users.FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);
        if (user is null)
        {
            return Unauthorized();
        }

        var response = CreateAuthResponse(user);
        return Ok(response);
    }

    private AuthResponse CreateAuthResponse(User user)
    {
        var accessToken = jwtTokenService.CreateAccessToken(user);
        var refreshToken = jwtTokenService.CreateRefreshToken();
        refreshTokenStore.Save(refreshToken, user.Id);

        return new AuthResponse
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            User = user
        };
    }
}
