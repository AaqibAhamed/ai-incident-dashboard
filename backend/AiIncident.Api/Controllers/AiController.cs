using AiIncident.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AiIncident.Api.Controllers;

public sealed class TicketRequest
{
    public string TicketId { get; set; } = string.Empty;
}

public sealed class FormAssistRequest
{
    public string Text { get; set; } = string.Empty;
}

public sealed class HealthReportRequest
{
    public string Range { get; set; } = string.Empty;
}

[ApiController]
[Route("api/ai")]
[Authorize]
public sealed class AiController(IAiAssistant assistant) : ControllerBase
{
    [HttpPost("summary")]
    public ActionResult<AiTicketSummary> Summary([FromBody] TicketRequest request) =>
        Ok(assistant.SummarizeTicket(request.TicketId));

    [HttpPost("reply")]
    public ActionResult<AiSuggestedReply> Reply([FromBody] TicketRequest request) =>
        Ok(assistant.SuggestedReply(request.TicketId));

    [HttpPost("form-assist")]
    public ActionResult<AiFormAssist> FormAssist([FromBody] FormAssistRequest request) =>
        Ok(assistant.AssistForm(request.Text));

    [HttpPost("health-report")]
    public ActionResult<AiHealthReport> HealthReport([FromBody] HealthReportRequest request) =>
        Ok(assistant.HealthReport(request.Range));
}
