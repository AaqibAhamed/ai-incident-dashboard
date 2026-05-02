using Microsoft.AspNetCore.Mvc;

namespace AiIncident.Api.Controllers;

[ApiController]
[Route("api")]
public sealed class UtilityController : ControllerBase
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
    public ActionResult<object> Upload()
    {
        var id = $"file-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        return Ok(new { id, url = "/api/files/upload.bin" });
    }
}
