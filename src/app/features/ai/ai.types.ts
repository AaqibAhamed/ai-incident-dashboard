export interface AiTicketSummary {
  problem: string;
  impact: string;
  nextSteps: string;
}

export interface AiSuggestedReply {
  draft: string;
}

export interface AiFormAssist {
  title: string;
  category: string;
  priority: string;
}

export interface AiHealthReport {
  summary: string;
}
