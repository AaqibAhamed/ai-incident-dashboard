using AiIncident.Api.Data;
using AiIncident.Api.Models;
using AiIncident.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AiIncident.Api.Controllers;

public sealed class CreateTenantRequest
{
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string PrimaryEmailDomain { get; set; } = string.Empty;
    public string TenantAdminName { get; set; } = string.Empty;
    public string TenantAdminPassword { get; set; } = string.Empty;
}

public sealed class UpdatePlatformTenantRequest
{
    public string? Name { get; set; }
    public string? Slug { get; set; }
}

public sealed class UpdatePlatformTenantAdminRequest
{
    public string? Name { get; set; }

    /// <summary>Local part only (before @). Domain stays the same as the admin's current address.</summary>
    public string? EmailLocalPart { get; set; }

    public string? Password { get; set; }
}

public sealed class AddTenantDomainRequest
{
    public string Domain { get; set; } = string.Empty;
    public bool IsPrimary { get; set; }
}

[ApiController]
[Route("api/platform/tenants")]
[Authorize(Roles = nameof(UserRole.SUPER_ADMIN))]
public sealed class PlatformTenantsController(AppDbContext db, IPasswordHasher passwordHasher) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<object>> List(CancellationToken cancellationToken)
    {
        var live = await db.Tenants.AsNoTracking()
            .Where(t => t.Status != TenantStatus.Deleted)
            .OrderBy(t => t.Name)
            .Select(t => new
            {
                t.Id,
                t.Name,
                t.Slug,
                status = t.Status.ToString(),
                t.CreatedAt,
                primaryDomain = t.EmailDomains.Where(d => d.IsPrimary).Select(d => d.Domain).FirstOrDefault()
                    ?? t.EmailDomains.Select(d => d.Domain).FirstOrDefault(),
                tenantAdmin = db.Users.AsNoTracking()
                    .Where(u => u.TenantId == t.Id && u.Role == UserRole.TENANT_ADMIN)
                    .OrderBy(u => u.Id)
                    .Select(u => new { u.Id, u.Name, u.Email, u.IsActive })
                    .FirstOrDefault()
            })
            .ToListAsync(cancellationToken);

        var deleted = await db.Tenants.AsNoTracking()
            .Where(t => t.Status == TenantStatus.Deleted)
            .OrderBy(t => t.Name)
            .Select(t => new
            {
                t.Id,
                t.Name,
                t.Slug,
                status = t.Status.ToString(),
                t.CreatedAt,
                primaryDomain = t.EmailDomains.Where(d => d.IsPrimary).Select(d => d.Domain).FirstOrDefault()
                    ?? t.EmailDomains.Select(d => d.Domain).FirstOrDefault(),
                tenantAdmin = db.Users.AsNoTracking()
                    .Where(u => u.TenantId == t.Id && u.Role == UserRole.TENANT_ADMIN)
                    .OrderBy(u => u.Id)
                    .Select(u => new { u.Id, u.Name, u.Email, u.IsActive })
                    .FirstOrDefault()
            })
            .ToListAsync(cancellationToken);

        return Ok(new { live, deleted });
    }

    [HttpGet("{tenantId}")]
    public async Task<ActionResult<object>> Get(string tenantId, CancellationToken cancellationToken)
    {
        var row = await db.Tenants.AsNoTracking()
            .Where(t => t.Id == tenantId)
            .Select(t => new
            {
                t.Id,
                t.Name,
                t.Slug,
                status = t.Status.ToString(),
                t.CreatedAt,
                domains = t.EmailDomains
                    .OrderByDescending(d => d.IsPrimary)
                    .ThenBy(d => d.Domain)
                    .Select(d => new { d.Domain, d.IsPrimary })
                    .ToList(),
                tenantAdmin = db.Users.AsNoTracking()
                    .Where(u => u.TenantId == t.Id && u.Role == UserRole.TENANT_ADMIN)
                    .OrderBy(u => u.Id)
                    .Select(u => new { u.Id, u.Name, u.Email, u.IsActive })
                    .FirstOrDefault()
            })
            .FirstOrDefaultAsync(cancellationToken);
        if (row is null)
        {
            return NotFound();
        }

        return Ok(row);
    }

    [HttpPost]
    public async Task<ActionResult<object>> Create([FromBody] CreateTenantRequest request, CancellationToken cancellationToken)
    {
        var name = request.Name.Trim();
        var slug = request.Slug.Trim().ToLowerInvariant();
        var domain = request.PrimaryEmailDomain.Trim().ToLowerInvariant();
        var adminName = request.TenantAdminName.Trim();
        var adminPassword = request.TenantAdminPassword;

        if (name.Length < 2 || slug.Length < 2 || domain.Length < 3)
        {
            return BadRequest(new { message = "Name, slug, and primaryEmailDomain are required." });
        }

        if (adminName.Length < 1 || string.IsNullOrEmpty(adminPassword) || adminPassword.Length < 4)
        {
            return BadRequest(new { message = "Tenant admin name and password (min 4 characters) are required." });
        }

        if (await db.Tenants.AnyAsync(t => t.Slug == slug, cancellationToken))
        {
            return Conflict(new { message = "Slug already in use." });
        }

        if (await db.TenantEmailDomains.AnyAsync(d => d.Domain == domain, cancellationToken))
        {
            return Conflict(new { message = "This primary email domain is already registered." });
        }

        if (TenantLoginHelper.IsBlockedConsumerDomain(domain))
        {
            return BadRequest(new { message = "Mapping consumer email domains is not allowed." });
        }

        string adminEmail;
        try
        {
            adminEmail = await TenantAdminEmailFactory.AllocateUniqueEmailAsync(db, adminName, domain, cancellationToken);
        }
        catch (InvalidOperationException)
        {
            return Conflict(new { message = "Could not allocate a unique email for the tenant admin." });
        }

        var now = DateTime.UtcNow;
        var id = $"tenant-{Guid.NewGuid():N}"[..18];
        var tenant = new Tenant
        {
            Id = id,
            Name = name,
            Slug = slug,
            Status = TenantStatus.Active,
            CreatedAt = now,
            UpdatedAt = now
        };
        db.Tenants.Add(tenant);
        db.TenantEmailDomains.Add(new TenantEmailDomain
        {
            Domain = domain,
            TenantId = id,
            IsPrimary = true
        });

        var adminId = $"u-{Guid.NewGuid():N}"[..12];
        db.Users.Add(new User
        {
            Id = adminId,
            TenantId = id,
            Name = adminName,
            Email = adminEmail,
            Role = UserRole.TENANT_ADMIN,
            PasswordHash = passwordHasher.HashPassword(adminPassword),
            IsActive = true
        });

        await db.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            tenant.Id,
            tenant.Name,
            tenant.Slug,
            primaryDomain = domain,
            tenantAdmin = new { id = adminId, name = adminName, email = adminEmail }
        });
    }

    [HttpPatch("{tenantId}")]
    public async Task<ActionResult> UpdateTenant(string tenantId, [FromBody] UpdatePlatformTenantRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name) && string.IsNullOrWhiteSpace(request.Slug))
        {
            return BadRequest(new { message = "Provide name and/or slug to update." });
        }

        var tenant = await db.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken);
        if (tenant is null)
        {
            return NotFound();
        }

        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            var n = request.Name.Trim();
            if (n.Length < 2)
            {
                return BadRequest(new { message = "Name is too short." });
            }

            tenant.Name = n;
        }

        if (!string.IsNullOrWhiteSpace(request.Slug))
        {
            var s = request.Slug.Trim().ToLowerInvariant();
            if (s.Length < 2)
            {
                return BadRequest(new { message = "Slug is too short." });
            }

            if (await db.Tenants.AnyAsync(t => t.Slug == s && t.Id != tenantId, cancellationToken))
            {
                return Conflict(new { message = "Slug already in use." });
            }

            tenant.Slug = s;
        }

        tenant.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return Ok();
    }

    [HttpPatch("{tenantId}/tenant-admins/{userId}")]
    public async Task<ActionResult> UpdateTenantAdmin(
        string tenantId,
        string userId,
        [FromBody] UpdatePlatformTenantAdminRequest request,
        CancellationToken cancellationToken)
    {
        var hasEmailLocal = !string.IsNullOrWhiteSpace(request.EmailLocalPart);
        if (request.Name is null && request.Password is null && !hasEmailLocal)
        {
            return BadRequest(new { message = "Provide name, email local part, and/or password to update." });
        }

        var user = await db.Users.FirstOrDefaultAsync(
            u => u.Id == userId && u.TenantId == tenantId,
            cancellationToken);
        if (user is null || user.Role != UserRole.TENANT_ADMIN)
        {
            return NotFound();
        }

        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            var n = request.Name.Trim();
            if (n.Length < 1)
            {
                return BadRequest(new { message = "Name is invalid." });
            }

            user.Name = n;
        }

        if (hasEmailLocal)
        {
            if (!TenantAdminEmailFactory.TryNormalizeEmailLocalPart(
                    request.EmailLocalPart!,
                    out var localPart,
                    out var localError))
            {
                return BadRequest(new { message = localError ?? "Invalid email local part." });
            }

            if (!TenantLoginHelper.TryGetEmailDomain(user.Email, out var existingDomain))
            {
                return BadRequest(new { message = "Could not read domain from current admin email." });
            }

            var newEmail = TenantLoginHelper.NormalizeEmail($"{localPart}@{existingDomain}");
            if (newEmail != user.Email)
            {
                if (await db.Users.AnyAsync(
                        u => u.TenantId == tenantId && u.Email == newEmail && u.Id != userId,
                        cancellationToken))
                {
                    return Conflict(new { message = "A user with this email already exists in the tenant." });
                }

                user.Email = newEmail;
            }
        }

        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            if (request.Password.Length < 4)
            {
                return BadRequest(new { message = "Password must be at least 4 characters." });
            }

            user.PasswordHash = passwordHasher.HashPassword(request.Password);
        }

        await db.SaveChangesAsync(cancellationToken);
        return Ok();
    }

    [HttpPost("{tenantId}/domains")]
    public async Task<ActionResult> AddDomain(string tenantId, [FromBody] AddTenantDomainRequest request, CancellationToken cancellationToken)
    {
        var domain = request.Domain.Trim().ToLowerInvariant();
        if (domain.Length < 3)
        {
            return BadRequest(new { message = "Invalid domain." });
        }

        if (TenantLoginHelper.IsBlockedConsumerDomain(domain))
        {
            return BadRequest(new { message = "Mapping consumer email domains is not allowed." });
        }

        var tenant = await db.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken);
        if (tenant is null)
        {
            return NotFound();
        }

        if (request.IsPrimary)
        {
            return BadRequest(new { message = "Primary email domain is set at tenant creation and cannot be changed." });
        }

        if (await db.TenantEmailDomains.AnyAsync(d => d.Domain == domain, cancellationToken))
        {
            return Conflict(new { message = "Domain already mapped." });
        }

        db.TenantEmailDomains.Add(new TenantEmailDomain
        {
            Domain = domain,
            TenantId = tenantId,
            IsPrimary = false
        });
        tenant.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return Ok();
    }

    [HttpPatch("{tenantId}/suspend")]
    public async Task<ActionResult> Suspend(string tenantId, CancellationToken cancellationToken)
    {
        var tenant = await db.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken);
        if (tenant is null)
        {
            return NotFound();
        }

        if (tenant.Status != TenantStatus.Active)
        {
            return Conflict(new { message = "Only an active tenant can be suspended." });
        }

        tenant.Status = TenantStatus.Suspended;
        tenant.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return Ok();
    }

    [HttpPatch("{tenantId}/resume")]
    public async Task<ActionResult> Resume(string tenantId, CancellationToken cancellationToken)
    {
        var tenant = await db.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken);
        if (tenant is null)
        {
            return NotFound();
        }

        if (tenant.Status != TenantStatus.Suspended)
        {
            return Conflict(new { message = "Only a suspended tenant can be resumed." });
        }

        tenant.Status = TenantStatus.Active;
        tenant.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return Ok();
    }

    [HttpPatch("{tenantId}/delete")]
    public async Task<ActionResult> SoftDelete(string tenantId, CancellationToken cancellationToken)
    {
        var tenant = await db.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken);
        if (tenant is null)
        {
            return NotFound();
        }

        if (tenant.Status == TenantStatus.Deleted)
        {
            return Ok();
        }

        if (tenant.Status is not (TenantStatus.Active or TenantStatus.Suspended))
        {
            return Conflict(new { message = "Tenant cannot be deleted in its current state." });
        }

        tenant.Status = TenantStatus.Deleted;
        tenant.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return Ok();
    }

    [HttpPatch("{tenantId}/restore")]
    public async Task<ActionResult> Restore(string tenantId, CancellationToken cancellationToken)
    {
        var tenant = await db.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken);
        if (tenant is null)
        {
            return NotFound();
        }

        if (tenant.Status != TenantStatus.Deleted)
        {
            return Conflict(new { message = "Only a deleted tenant can be restored." });
        }

        tenant.Status = TenantStatus.Active;
        tenant.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return Ok();
    }
}
