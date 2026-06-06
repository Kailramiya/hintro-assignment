import { GoogleGenerativeAI, GenerationConfig } from '@google/generative-ai';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { AIAnalysisResult, TranscriptEntry, Participant } from '../../types';

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

const generationConfig: GenerationConfig = {
  temperature: 0.1,
  topP: 0.8,
  responseMimeType: 'application/json',
};

function formatTranscript(entries: TranscriptEntry[]): string {
  return entries
    .map((e) => `[${e.timestamp}] ${e.speaker}: ${e.text}`)
    .join('\n');
}

function buildPrompt(
  title: string,
  meetingDate: string,
  participants: Participant[],
  transcript: TranscriptEntry[]
): string {
  const formattedTranscript = formatTranscript(transcript);
  const speakers = [...new Set(transcript.map((e) => e.speaker))].join(', ');

  return `You are a meeting intelligence assistant. Your sole job is to extract structured insights from the transcript below.

MEETING DETAILS:
- Title: ${title}
- Date: ${meetingDate}
- Registered Participants: ${participants.map((p) => p.name).join(', ')}
- Actual Speakers in Transcript: ${speakers}

CRITICAL GROUNDING RULES — violations will cause your output to be rejected:
1. ONLY reference people who appear as speakers in the transcript. Never use names from participants list if they never spoke.
2. For EVERY action item and decision, you MUST provide the exact quote from the transcript as citationText.
3. citationTimestamp MUST be copied exactly as it appears in the transcript (format: HH:MM:SS).
4. citationSpeaker MUST be the exact speaker name as it appears in the transcript.
5. Do NOT invent, assume, or infer anything not explicitly stated.
6. If a due date is mentioned, extract it; otherwise set dueDate to null.
7. If no action items exist in the transcript, return an empty array.
8. If no decisions were made, return an empty array.

TRANSCRIPT:
${formattedTranscript}

Return ONLY valid JSON matching this exact schema. No markdown, no code fences, no explanation:
{
  "summary": "string — 2-4 sentence overview of what was discussed and decided (grounded only in what was said)",
  "actionItems": [
    {
      "title": "string — short action item label",
      "description": "string — full description of the task",
      "assignee": "string — MUST be a speaker name from transcript",
      "dueDate": "ISO 8601 date string or null",
      "citationText": "string — exact verbatim quote from transcript that supports this action item",
      "citationTimestamp": "string — timestamp copied exactly from transcript",
      "citationSpeaker": "string — speaker name copied exactly from transcript"
    }
  ],
  "decisions": [
    {
      "description": "string — what was decided",
      "citationText": "string — exact verbatim quote from transcript",
      "citationTimestamp": "string — timestamp copied exactly from transcript",
      "citationSpeaker": "string — speaker name copied exactly from transcript"
    }
  ],
  "followUpSuggestions": [
    "string — actionable suggestion based on gaps or risks identified in the meeting"
  ]
}`;
}

function validateCitations(
  result: AIAnalysisResult,
  transcript: TranscriptEntry[]
): AIAnalysisResult {
  const speakers = new Set(transcript.map((e) => e.speaker.toLowerCase()));
  const timestamps = new Set(transcript.map((e) => e.timestamp));

  const validateItem = (item: { citationSpeaker?: string; citationTimestamp?: string }) => {
    if (item.citationSpeaker && !speakers.has(item.citationSpeaker.toLowerCase())) {
      logger.warn('AI cited a speaker not in transcript', { speaker: item.citationSpeaker });
    }
    if (item.citationTimestamp && !timestamps.has(item.citationTimestamp)) {
      logger.warn('AI cited a timestamp not in transcript', { timestamp: item.citationTimestamp });
    }
  };

  result.actionItems.forEach(validateItem);
  result.decisions.forEach(validateItem);

  // Filter action items to only those where assignee was an actual speaker
  result.actionItems = result.actionItems.filter((item) => {
    const valid = speakers.has(item.assignee.toLowerCase());
    if (!valid) {
      logger.warn('Dropping action item: assignee not in transcript', { assignee: item.assignee });
    }
    return valid;
  });

  return result;
}

export async function analyzeMeeting(
  traceId: string,
  meetingId: string,
  title: string,
  meetingDate: Date,
  participants: Participant[],
  transcript: TranscriptEntry[]
): Promise<AIAnalysisResult> {
  logger.info('Starting AI analysis', { traceId, meetingId });

  const model = genAI.getGenerativeModel(
    { model: 'gemini-2.0-flash-lite', generationConfig },
    { apiVersion: 'v1beta' }
  );

  const prompt = buildPrompt(title, meetingDate.toISOString(), participants, transcript);

  try {
    const response = await model.generateContent(prompt);
    const rawText = response.response.text().trim();

    logger.debug('Gemini raw response', { traceId, rawText: rawText.slice(0, 500) });

    let parsed: AIAnalysisResult;
    try {
      parsed = JSON.parse(rawText) as AIAnalysisResult;
    } catch {
      // Gemini occasionally wraps JSON in code fences despite responseMimeType
      const cleaned = rawText.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '');
      parsed = JSON.parse(cleaned) as AIAnalysisResult;
    }

    const validated = validateCitations(parsed, transcript);
    logger.info('AI analysis complete', {
      traceId,
      meetingId,
      actionItems: validated.actionItems.length,
      decisions: validated.decisions.length,
    });

    return validated;
  } catch (err) {
    logger.error('Gemini API error', { traceId, meetingId, error: String(err) });
    throw new Error(`AI analysis failed: ${String(err)}`);
  }
}
