namespace AiIncident.Api.Services;

public sealed record AiTicketSummary(string Problem, string Impact, string NextSteps);
public sealed record AiSuggestedReply(string Draft);
public sealed record AiFormAssist(string Title, string Category, string Priority);
public sealed record AiHealthReport(string Summary);

public interface IAiAssistant
{
    AiTicketSummary SummarizeTicket(string ticketId);
    AiSuggestedReply SuggestedReply(string ticketId);
    AiFormAssist AssistForm(string text);
    AiHealthReport HealthReport(string range);
}

public sealed class StubAiAssistant : IAiAssistant
{
    public AiTicketSummary SummarizeTicket(string ticketId) =>
        new(
            "Connectivity / authentication issue affecting remote access.",
            "Users cannot reach internal apps via VPN.",
            "Verify gateway logs, reset MFA device, and confirm WiFi captive portal bypass."
        );

    public AiSuggestedReply SuggestedReply(string ticketId) =>
        new(
            "Thanks for the details. Could you confirm whether this happens only on office WiFi and whether other devices show the same behavior?"
        );

    public AiFormAssist AssistForm(string text)
    {
        var lower = text.ToLowerInvariant();
        var isVpn = lower.Contains("vpn", StringComparison.Ordinal);
        var isUrgent = lower.Contains("down", StringComparison.Ordinal) || lower.Contains("not working", StringComparison.Ordinal);
        return new AiFormAssist(
            isVpn ? "VPN connectivity issue" : "General IT request",
            isVpn ? "Network" : "General",
            isUrgent ? "P2" : "P3");
    }

    public AiHealthReport HealthReport(string range) =>
        new(
            "Overall queue health is stable: SLA risk concentrated in P1 VPN tickets. Recommend staffing Network on-call and publishing a WiFi/VPN FAQ."
        );
}
