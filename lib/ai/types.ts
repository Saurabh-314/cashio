import type { CurrencyCode, DateFormat } from "@/types";

export const AI_ACTION_TYPES = [
  "create_expense",
  "create_income",
  "create_transfer",
  "create_lending",
  "create_borrowing",
  "record_repayment",
  "create_daily_activity",
  "create_note",
  "create_bill",
  "create_goal_contribution",
] as const;

export type AIActionType = (typeof AI_ACTION_TYPES)[number];

export const AI_READ_TOOLS = [
  "get_account_summary",
  "get_transaction_summary",
  "get_transactions",
  "get_category_spending",
  "get_budget_summary",
  "get_goal_summary",
  "get_bill_summary",
  "get_loan_summary",
  "get_people_summary",
  "get_udhar_summary",
  "get_daily_check_summary",
  "get_net_worth",
  "get_upcoming_commitments",
  "get_monthly_review",
  "get_weekly_review",
  "get_financial_health",
  "can_afford",
  "suggest_spending_cuts",
] as const;

export type AIReadToolName = (typeof AI_READ_TOOLS)[number];
export type AIWriteToolName = AIActionType;
export type AIToolName = AIReadToolName | AIWriteToolName;

export const AI_ACTION_STATUSES = [
  "pending",
  "confirmed",
  "executed",
  "cancelled",
  "failed",
] as const;

export type AIActionStatus = (typeof AI_ACTION_STATUSES)[number];

export type AIMessageRole = "user" | "assistant";

export interface AIConversation {
  id: string;
  userId: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIMessage {
  id: string;
  conversationId: string;
  role: AIMessageRole;
  content: string;
  actions?: AIActionView[];
  createdAt: string;
}

export interface AIActionField {
  label: string;
  value: string;
}

export interface AIActionView {
  id: string;
  type: AIActionType;
  title: string;
  summary: string;
  fields: AIActionField[];
  requiresConfirmation: true;
  status: AIActionStatus;
  href?: string;
  resultSummary?: string;
}

export interface AIActionRecord {
  id: string;
  userId: string;
  conversationId: string;
  actionType: AIActionType;
  payload: Record<string, unknown>;
  display: AIActionView;
  status: AIActionStatus;
  result?: Record<string, unknown>;
  error?: string;
  createdAt: string;
  executedAt?: string;
  updatedAt: string;
}

export interface AIAuditLog {
  id: string;
  userId: string;
  conversationId: string;
  actionId?: string;
  actionType: string;
  payload: Record<string, unknown>;
  status: AIActionStatus | "proposed" | "read";
  createdAt: string;
  executedAt?: string;
}

export interface AIChatRequest {
  message: string;
  conversationId?: string;
}

export interface AIChatSuccess {
  success: true;
  data: {
    message: string;
    conversationId: string;
    actions?: AIActionView[];
  };
}

export interface AIChatFailure {
  success: false;
  error: string;
}

export type AIChatResponse = AIChatSuccess | AIChatFailure;

export interface AIConfirmRequest {
  actionId: string;
  conversationId: string;
}

export interface AIToolParameter {
  type: "object";
  properties: Record<
    string,
    {
      type: "string" | "number" | "boolean" | "integer";
      description?: string;
      enum?: string[];
    }
  >;
  required?: string[];
  additionalProperties?: boolean;
}

export interface AIToolDefinition {
  name: AIToolName;
  description: string;
  parameters: AIToolParameter;
  permission: "read" | "write";
}

export interface AIProviderToolCall {
  id: string;
  name: string;
  arguments: string;
}

export type AIProviderMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: AIProviderToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface AIToolExecutionResult {
  content: string;
  action?: AIActionView;
}

export interface AIChatRequestPayload {
  messages: AIProviderMessage[];
  tools?: AIToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  executeTool?: (name: string, args: Record<string, unknown>) => Promise<AIToolExecutionResult>;
}

export interface AIChatResult {
  content: string | null;
  toolCalls: AIProviderToolCall[];
  actions?: AIActionView[];
  toolsHandled?: boolean;
}

export interface AIProvider {
  chat(request: AIChatRequestPayload): Promise<AIChatResult>;
}

export interface DateRange {
  start: string;
  end: string;
  label: string;
}

export interface MoneyField {
  amount: number;
  formatted: string;
}

export interface AIContextSnapshotMeta {
  today: string;
  timezone: string;
  currency: CurrencyCode;
  dateFormat: DateFormat;
  monthStartDay: number;
  displayName: string;
}
