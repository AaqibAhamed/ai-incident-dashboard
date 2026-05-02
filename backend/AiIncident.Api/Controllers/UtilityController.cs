using AiIncident.Api.Data;
using AiIncident.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace AiIncident.Api.Controllers;

[ApiController]
[Route("api")]
public sealed class UtilityController(
    AppDbContext db,
    IWebHostEnvironment environment) : ControllerBase
{
    [HttpGet("validate-asset")]
    public ActionResult<object> ValidateAsset([FromQuery] string assetTag)
    {
        if (assetTag.Trim().Length < 4)
        {
            return BadRequest(new { valid = false, message = "Asset tag too short" });
        }

        return Ok(new { valid = true, assetId = $"AST-{assetTag.Trim().ToUpperInvariant()}" });
    }

    [HttpPost("upload")]
    public async Task<ActionResult<object>> Upload([FromForm] List<IFormFile> files, CancellationToken cancellationToken)
    {
        if (files.Count == 0)
        {
            return BadRequest(new { message = "No files uploaded." });
        }

        var uploadsRoot = System.IO.Path.Combine(environment.ContentRootPath, "..", "uploads");
        Directory.CreateDirectory(uploadsRoot);

        var uploaderId = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub)
            ?? User.FindFirstValue("sub")
            ?? "u-agent";
        var uploaderExists = await db.Users.AnyAsync(u => u.Id == uploaderId, cancellationToken);
        if (!uploaderExists)
        {
            uploaderId = "u-agent";
        }

        var uploaded = new List<object>(files.Count);
        foreach (var file in files)
        {
            if (file.Length == 0) continue;

            var id = $"file-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}-{Guid.NewGuid():N}".ToLowerInvariant();
            var ext = System.IO.Path.GetExtension(file.FileName);
            var storedName = $"{id}{ext}";
            var fullPath = System.IO.Path.Combine(uploadsRoot, storedName);

            await using (var stream = System.IO.File.Create(fullPath))
            {
                await file.CopyToAsync(stream, cancellationToken);
            }

            var asset = new MediaAsset
            {
                Id = id,
                OriginalFileName = file.FileName,
                StoredFileName = storedName,
                ContentType = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType,
                SizeBytes = file.Length,
                Url = $"/api/files/{storedName}",
                UploadedByUserId = uploaderId,
                UploadedAt = DateTime.UtcNow
            };
            db.MediaAssets.Add(asset);
            uploaded.Add(new
            {
                id = asset.Id,
                fileName = asset.OriginalFileName,
                contentType = asset.ContentType,
                sizeBytes = asset.SizeBytes,
                uploadedByUserId = asset.UploadedByUserId,
                uploadedAt = asset.UploadedAt,
                url = asset.Url
            });
        }

        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { files = uploaded });
    }

    [HttpGet("files/{storedName}")]
    public async Task<IActionResult> GetFile(string storedName, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(storedName))
        {
            return NotFound();
        }

        var uploadsRoot = System.IO.Path.Combine(environment.ContentRootPath, "..", "uploads");
        var fullPath = System.IO.Path.Combine(uploadsRoot, storedName);
        if (!System.IO.File.Exists(fullPath))
        {
            return NotFound();
        }

        var asset = await db.MediaAssets.FirstOrDefaultAsync(a => a.StoredFileName == storedName, cancellationToken);
        var contentType = asset?.ContentType ?? "application/octet-stream";
        return PhysicalFile(fullPath, contentType);
    }
}
