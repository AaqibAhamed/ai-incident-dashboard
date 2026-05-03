using AiIncident.Api.Data;
using AiIncident.Api.Models;
using AiIncident.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace AiIncident.Api.Controllers;

public sealed class CreateTenantUserRequest
{
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public string Password { get; set; } = string.Empty;
}

public sealed class UpdateTenantUserRequest
{
    public bool? IsActive { get; set; }
}

[ApiController]
[Route("api/tenant/users")]
[Authorize(Roles = nameof(UserRole.TENANT_ADMIN))]
public sealed class TenantUsersController(
    AppDbContext db,
    IPasswordHasher passwordHasher,
    IHttpContextAccessor httpContextAccessor) : ControllerBase
{
    private string? TenantIdFromClaims =>
        httpContextAccessor.HttpContext?.User.FindFirstValue("tenant_id");

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<object>>> List(CancellationToken cancellationToken)
    {
        var tenantId = TenantIdFromClaims;
        if (string.IsNullOrEmpty(tenantId))
        {
            return Forbid();
        }

        var users = await db.Users.AsNoTracking()
            .Where(u => u.TenantId == tenantId)
            .OrderBy(u => u.Name)
            .Select(u => new
            {
                u.Id,
                u.Name,
                u.Email,
                role = u.Role.ToString(),
                u.IsActive
            })
            .ToListAsync(cancellationToken);
        return Ok(users);
    }

    [HttpPost]
    public async Task<ActionResult<object>> Create([FromBody] CreateTenantUserRequest request, CancellationToken cancellationToken)
    {
        var tenantId = TenantIdFromClaims;
        if (string.IsNullOrEmpty(tenantId))
        {
            return Forbid();
        }

        if (request.Role is UserRole.SUPER_ADMIN or UserRole.TENANT_ADMIN)
        {
            return BadRequest(new { message = "Cannot create this role via tenant admin API." });
        }

        var email = TenantLoginHelper.NormalizeEmail(request.Email);
        var name = request.Name.Trim();
        if (name.Length < 1 || string.IsNullOrEmpty(request.Password) || request.Password.Length < 4)
        {
            return BadRequest(new { message = "Name and password (min 4 chars) are required." });
        }

        if (await db.Users.AnyAsync(u => u.TenantId == tenantId && u.Email == email, cancellationToken))
        {
            return Conflict(new { message = "A user with this email already exists in the tenant." });
        }

        var id = $"u-{Guid.NewGuid():N}"[..12];
        var user = new User
        {
            Id = id,
            TenantId = tenantId,
            Name = name,
            Email = email,
            Role = request.Role,
            PasswordHash = passwordHasher.HashPassword(request.Password),
            IsActive = true
        };
        db.Users.Add(user);
        await db.SaveChangesAsync(cancellationToken);

        return Ok(new { user.Id, user.Name, user.Email, role = user.Role.ToString() });
    }

    [HttpPatch("{userId}")]
    public async Task<ActionResult> Update(string userId, [FromBody] UpdateTenantUserRequest request, CancellationToken cancellationToken)
    {
        var tenantId = TenantIdFromClaims;
        if (string.IsNullOrEmpty(tenantId))
        {
            return Forbid();
        }

        var user = await db.Users.FirstOrDefaultAsync(
            u => u.Id == userId && u.TenantId == tenantId,
            cancellationToken);
        if (user is null)
        {
            return NotFound();
        }

        if (user.Role == UserRole.TENANT_ADMIN)
        {
            return BadRequest(new { message = "Cannot change tenant admin via this endpoint." });
        }

        if (request.IsActive is not null)
        {
            user.IsActive = request.IsActive.Value;
        }

        await db.SaveChangesAsync(cancellationToken);
        return Ok();
    }
}
