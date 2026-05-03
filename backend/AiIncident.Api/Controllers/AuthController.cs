using AiIncident.Api.Data;
using AiIncident.Api.Models;
using AiIncident.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AiIncident.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(
    AppDbContext db,
    IJwtTokenService jwtTokenService,
    IRefreshTokenStore refreshTokenStore,
    IPasswordHasher passwordHasher) : ControllerBase
{
    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { message = "Email and password are required." });
        }

        var email = TenantLoginHelper.NormalizeEmail(request.Email);

        var superCandidate = await db.Users.AsNoTracking()
            .FirstOrDefaultAsync(
                u => u.TenantId == null && u.Role == UserRole.SUPER_ADMIN && u.Email == email,
                cancellationToken);

        User authenticated;
        Tenant? tenant = null;

        if (superCandidate is not null)
        {
            if (!superCandidate.IsActive || !passwordHasher.VerifyPassword(request.Password, superCandidate.PasswordHash))
            {
                return Unauthorized(new { message = "Invalid email or password." });
            }

            authenticated = superCandidate;
        }
        else
        {
            if (!TenantLoginHelper.TryGetEmailDomain(email, out var domain))
            {
                return BadRequest(new { message = "Invalid email address." });
            }

            if (TenantLoginHelper.IsBlockedConsumerDomain(domain))
            {
                return BadRequest(new
                {
                    message = "Consumer email domains are not allowed. Use your organization email, or ask a tenant admin to invite you."
                });
            }

            var map = await db.TenantEmailDomains
                .Include(m => m.Tenant)
                .FirstOrDefaultAsync(m => m.Domain == domain, cancellationToken);

            if (map?.Tenant is null)
            {
                return Unauthorized(new { message = "No tenant is registered for this email domain." });
            }

            tenant = map.Tenant;
            if (tenant.Status == TenantStatus.Suspended)
            {
                return Unauthorized(new { message = "This organization account is suspended." });
            }

            var tenantUser = await db.Users.AsNoTracking()
                .FirstOrDefaultAsync(u => u.TenantId == tenant.Id && u.Email == email, cancellationToken);

            if (tenantUser is null || !tenantUser.IsActive ||
                !passwordHasher.VerifyPassword(request.Password, tenantUser.PasswordHash))
            {
                return Unauthorized(new { message = "Invalid email or password." });
            }

            authenticated = tenantUser;
        }

        if (authenticated.TenantId is not null)
        {
            tenant = await db.Tenants.AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == authenticated.TenantId, cancellationToken);
        }

        return Ok(CreateAuthResponse(authenticated, tenant));
    }

    [AllowAnonymous]
    [HttpPost("refresh")]
    public async Task<ActionResult<AuthResponse>> Refresh([FromBody] RefreshRequest request, CancellationToken cancellationToken)
    {
        if (!refreshTokenStore.TryGetUser(request.RefreshToken, out var userId))
        {
            return Unauthorized();
        }

        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);
        if (user is null || !user.IsActive)
        {
            return Unauthorized();
        }

        Tenant? tenant = null;
        if (user.TenantId is not null)
        {
            tenant = await db.Tenants.AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == user.TenantId, cancellationToken);
            if (tenant?.Status == TenantStatus.Suspended)
            {
                return Unauthorized(new { message = "This organization account is suspended." });
            }
        }

        return Ok(CreateAuthResponse(user, tenant));
    }

    private AuthResponse CreateAuthResponse(User user, Tenant? tenant)
    {
        var accessToken = jwtTokenService.CreateAccessToken(user, tenant?.Slug);
        var refreshToken = jwtTokenService.CreateRefreshToken();
        refreshTokenStore.Save(refreshToken, user.Id);

        return new AuthResponse
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            User = new AuthUserDto
            {
                Id = user.Id,
                Name = user.Name,
                Email = user.Email,
                Role = user.Role
            },
            Tenant = tenant is null
                ? null
                : new TenantSummaryDto
                {
                    Id = tenant.Id,
                    Name = tenant.Name,
                    Slug = tenant.Slug
                }
        };
    }
}
