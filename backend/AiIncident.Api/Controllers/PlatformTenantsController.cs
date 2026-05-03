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
}

public sealed class AddTenantDomainRequest
{
    public string Domain { get; set; } = string.Empty;
    public bool IsPrimary { get; set; }
}

[ApiController]
[Route("api/platform/tenants")]
[Authorize(Roles = nameof(UserRole.SUPER_ADMIN))]
public sealed class PlatformTenantsController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<object>>> List(CancellationToken cancellationToken)
    {
        var list = await db.Tenants.AsNoTracking()
            .OrderBy(t => t.Name)
            .Select(t => new
            {
                t.Id,
                t.Name,
                t.Slug,
                status = t.Status.ToString(),
                t.CreatedAt
            })
            .ToListAsync(cancellationToken);
        return Ok(list);
    }

    [HttpPost]
    public async Task<ActionResult<object>> Create([FromBody] CreateTenantRequest request, CancellationToken cancellationToken)
    {
        var name = request.Name.Trim();
        var slug = request.Slug.Trim().ToLowerInvariant();
        var domain = request.PrimaryEmailDomain.Trim().ToLowerInvariant();

        if (name.Length < 2 || slug.Length < 2 || domain.Length < 3)
        {
            return BadRequest(new { message = "Name, slug, and primaryEmailDomain are required." });
        }

        if (await db.Tenants.AnyAsync(t => t.Slug == slug, cancellationToken))
        {
            return Conflict(new { message = "Slug already in use." });
        }

        if (await db.TenantEmailDomains.AnyAsync(d => d.Domain == domain, cancellationToken))
        {
            return Conflict(new { message = "Email domain is already mapped to a tenant." });
        }

        if (TenantLoginHelper.IsBlockedConsumerDomain(domain))
        {
            return BadRequest(new { message = "Mapping consumer email domains is not allowed." });
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
        await db.SaveChangesAsync(cancellationToken);

        return Ok(new { tenant.Id, tenant.Name, tenant.Slug, primaryDomain = domain });
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

        if (await db.TenantEmailDomains.AnyAsync(d => d.Domain == domain, cancellationToken))
        {
            return Conflict(new { message = "Domain already mapped." });
        }

        db.TenantEmailDomains.Add(new TenantEmailDomain
        {
            Domain = domain,
            TenantId = tenantId,
            IsPrimary = request.IsPrimary
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

        tenant.Status = TenantStatus.Suspended;
        tenant.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return Ok();
    }

    [HttpPatch("{tenantId}/activate")]
    public async Task<ActionResult> Activate(string tenantId, CancellationToken cancellationToken)
    {
        var tenant = await db.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken);
        if (tenant is null)
        {
            return NotFound();
        }

        tenant.Status = TenantStatus.Active;
        tenant.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return Ok();
    }
}
