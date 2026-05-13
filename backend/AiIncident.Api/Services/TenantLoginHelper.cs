namespace AiIncident.Api.Services;

public static class TenantLoginHelper
{
    private static readonly HashSet<string> BlockedConsumerDomains = new(StringComparer.OrdinalIgnoreCase)
    {
        "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "hotmail.com", "outlook.com",
        "live.com", "icloud.com", "proton.me", "protonmail.com", "aol.com", "msn.com"
    };

    public static bool TryGetEmailDomain(string email, out string domain)
    {
        domain = "";
        var at = email.IndexOf('@');
        if (at < 0 || at == email.Length - 1)
        {
            return false;
        }

        domain = email[(at + 1)..].Trim().ToLowerInvariant();
        return domain.Length > 0;
    }

    public static bool IsBlockedConsumerDomain(string domain) =>
        BlockedConsumerDomains.Contains(domain.Trim().ToLowerInvariant());

    public static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();
}
