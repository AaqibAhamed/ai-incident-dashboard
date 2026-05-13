using AiIncident.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace AiIncident.Api.Services;

public static class TenantAdminEmailFactory
{
    /// <summary>
    /// Builds a stable local-part from a display name (lowercase labels, dot-separated, ASCII alphanumerics only).
    /// </summary>
    public static string BuildLocalPartFromDisplayName(string displayName)
    {
        var parts = displayName.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length == 0)
        {
            return "admin";
        }

        var segments = parts
            .Select(static p =>
                new string(p.ToLowerInvariant().Where(static c => char.IsAsciiLetterOrDigit(c)).ToArray()))
            .Where(static s => s.Length > 0)
            .ToArray();

        return segments.Length == 0 ? "admin" : string.Join('.', segments);
    }

    /// <summary>
    /// Returns normalized email local@domain, suffixing -1, -2, … until unique among tenant users.
    /// </summary>
    public static async Task<string> AllocateUniqueEmailAsync(
        AppDbContext db,
        string displayName,
        string domain,
        CancellationToken cancellationToken)
    {
        var localBase = BuildLocalPartFromDisplayName(displayName);
        for (var n = 0; n < 10_000; n++)
        {
            var localPart = n == 0 ? localBase : $"{localBase}-{n}";
            var candidate = TenantLoginHelper.NormalizeEmail($"{localPart}@{domain}");
            var taken = await db.Users.AsNoTracking()
                .AnyAsync(u => u.TenantId != null && u.Email == candidate, cancellationToken);
            if (!taken)
            {
                return candidate;
            }
        }

        throw new InvalidOperationException("Could not allocate a unique tenant admin email.");
    }

    /// <summary>
    /// Normalizes a user-supplied local part (before @). Lowercase; allows ASCII letters, digits, dot, hyphen, underscore.
    /// </summary>
    public static bool TryNormalizeEmailLocalPart(string input, out string localPart, out string? errorMessage)
    {
        localPart = "";
        errorMessage = null;
        var s = input.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(s))
        {
            errorMessage = "Email local part is required.";
            return false;
        }

        if (s.Contains('@', StringComparison.Ordinal))
        {
            errorMessage = "Enter only the part before @.";
            return false;
        }

        foreach (var c in s)
        {
            if (!(char.IsAsciiLetterOrDigit(c) || c is '.' or '-' or '_'))
            {
                errorMessage = "Email local part may only contain letters, digits, dots, hyphens, and underscores.";
                return false;
            }
        }

        if (s.StartsWith('.') || s.EndsWith('.') || s.Contains("..", StringComparison.Ordinal))
        {
            errorMessage = "Email local part cannot start or end with a dot or contain consecutive dots.";
            return false;
        }

        localPart = s;
        return true;
    }
}
