import { TEST_USER } from './auth.helper';

// Must be valid UUIDs — Zod validates meetingId as uuid()
export const MEETING_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
export const ANALYSIS_ID = 'b2c3d4e5-f6a7-8901-bcde-f01234567891';
export const ACTION_ITEM_ID = 'c3d4e5f6-a7b8-9012-cdef-012345678912';

export const SAMPLE_TRANSCRIPT = [
  { speaker: 'Alice Johnson', text: 'We need to finalize the API design by end of week.', timestamp: '00:01:00' },
  { speaker: 'Bob Smith', text: 'I will handle the database schema. I can have it done by Friday.', timestamp: '00:01:30' },
  { speaker: 'Alice Johnson', text: 'We decided to use PostgreSQL for all data storage.', timestamp: '00:02:00' },
  { speaker: 'Bob Smith', text: 'Agreed. I will also write the migration scripts.', timestamp: '00:02:15' },
];

export const SAMPLE_PARTICIPANTS = [
  { name: 'Alice Johnson', email: 'alice@example.com' },
  { name: 'Bob Smith', email: 'bob@example.com' },
];

export const SAMPLE_MEETING = {
  id: MEETING_ID,
  title: 'Q4 Sprint Planning',
  meetingDate: new Date('2024-12-01T10:00:00Z'),
  participants: SAMPLE_PARTICIPANTS,
  transcript: SAMPLE_TRANSCRIPT,
  analyzedAt: null,
  createdById: TEST_USER.id,
  createdAt: new Date('2024-12-01'),
  updatedAt: new Date('2024-12-01'),
};

export const SAMPLE_ANALYSIS = {
  id: ANALYSIS_ID,
  meetingId: MEETING_ID,
  summary: 'The team discussed Q4 sprint planning, focusing on API design and database decisions.',
  decisions: [
    {
      description: 'PostgreSQL selected for data storage',
      citationText: 'We decided to use PostgreSQL for all data storage.',
      citationTimestamp: '00:02:00',
      citationSpeaker: 'Alice Johnson',
    },
  ],
  followUpSuggestions: ['Schedule review of database schema before Friday deadline'],
  createdAt: new Date('2024-12-01'),
  updatedAt: new Date('2024-12-01'),
};

export const SAMPLE_ACTION_ITEM = {
  id: ACTION_ITEM_ID,
  meetingId: MEETING_ID,
  title: 'Complete database schema',
  description: 'Design and implement the database schema',
  assignee: 'Bob Smith',
  assigneeEmail: 'bob@example.com',
  dueDate: new Date('2024-12-06T00:00:00Z'),
  status: 'PENDING' as const,
  citationText: 'I will handle the database schema. I can have it done by Friday.',
  citationTimestamp: '00:01:30',
  citationSpeaker: 'Bob Smith',
  reminderSentAt: null,
  createdAt: new Date('2024-12-01'),
  updatedAt: new Date('2024-12-01'),
};

export const AI_ANALYSIS_RESULT = {
  summary: 'The team discussed API design and database decisions for Q4.',
  actionItems: [
    {
      title: 'Complete database schema',
      description: 'Design and implement the database schema',
      assignee: 'Bob Smith',
      dueDate: null,
      citationText: 'I will handle the database schema. I can have it done by Friday.',
      citationTimestamp: '00:01:30',
      citationSpeaker: 'Bob Smith',
    },
  ],
  decisions: [
    {
      description: 'PostgreSQL selected for data storage',
      citationText: 'We decided to use PostgreSQL for all data storage.',
      citationTimestamp: '00:02:00',
      citationSpeaker: 'Alice Johnson',
    },
  ],
  followUpSuggestions: ['Schedule a review of the completed schema'],
};
