import { Request } from 'express';

export interface AuthPayload {
  userId: string;
  email: string;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
  traceId?: string;
}

export interface Participant {
  name: string;
  email?: string;
}

export interface TranscriptEntry {
  speaker: string;
  text: string;
  timestamp: string;
}

export interface Citation {
  citationText: string;
  citationTimestamp: string;
  citationSpeaker: string;
}

export interface AIActionItem {
  title: string;
  description: string;
  assignee: string;
  dueDate: string | null;
  citationText: string;
  citationTimestamp: string;
  citationSpeaker: string;
}

export interface AIDecision {
  description: string;
  citationText: string;
  citationTimestamp: string;
  citationSpeaker: string;
}

export interface AIAnalysisResult {
  summary: string;
  actionItems: AIActionItem[];
  decisions: AIDecision[];
  followUpSuggestions: string[];
}

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
}
