import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import { env } from './env';

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Meeting Intelligence API',
    version: '1.0.0',
    description:
      'AI-powered meeting analysis service. Extracts summaries, action items, decisions, and follow-up suggestions from meeting transcripts — all grounded with transcript citations.',
    contact: {
      name: 'Aman Kundu',
      email: env.CANDIDATE_EMAIL,
    },
  },
  servers: [
    { url: env.DEPLOYED_URL || 'http://localhost:3000', description: 'Primary server' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ApiResponse: {
        type: 'object',
        properties: {
          traceId: { type: 'string', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
          success: { type: 'boolean' },
          data: { type: 'object', nullable: true },
          error: {
            nullable: true,
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
      Participant: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', example: 'Alice Johnson' },
          email: { type: 'string', format: 'email', example: 'alice@example.com' },
        },
      },
      TranscriptEntry: {
        type: 'object',
        required: ['speaker', 'text', 'timestamp'],
        properties: {
          speaker: { type: 'string', example: 'Alice Johnson' },
          text: { type: 'string', example: 'We should launch the beta by end of month.' },
          timestamp: { type: 'string', example: '00:02:15', description: 'HH:MM:SS format' },
        },
      },
      Citation: {
        type: 'object',
        properties: {
          citationText: { type: 'string', description: 'Exact quote from transcript' },
          citationTimestamp: { type: 'string', example: '00:02:15' },
          citationSpeaker: { type: 'string', example: 'Alice Johnson' },
        },
      },
      Meeting: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          participants: { type: 'array', items: { $ref: '#/components/schemas/Participant' } },
          meetingDate: { type: 'string', format: 'date-time' },
          transcript: { type: 'array', items: { $ref: '#/components/schemas/TranscriptEntry' } },
          analyzedAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          analysis: { $ref: '#/components/schemas/MeetingAnalysis', nullable: true },
        },
      },
      MeetingAnalysis: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          summary: { type: 'string' },
          decisions: {
            type: 'array',
            items: {
              allOf: [
                { $ref: '#/components/schemas/Citation' },
                {
                  type: 'object',
                  properties: { description: { type: 'string' } },
                },
              ],
            },
          },
          followUpSuggestions: { type: 'array', items: { type: 'string' } },
        },
      },
      ActionItem: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          meetingId: { type: 'string', format: 'uuid', nullable: true },
          title: { type: 'string' },
          description: { type: 'string', nullable: true },
          assignee: { type: 'string' },
          assigneeEmail: { type: 'string', format: 'email', nullable: true },
          dueDate: { type: 'string', format: 'date-time', nullable: true },
          status: { type: 'string', enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED'] },
          citationText: { type: 'string', nullable: true },
          citationTimestamp: { type: 'string', nullable: true },
          citationSpeaker: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      ValidationError: {
        type: 'object',
        properties: {
          traceId: { type: 'string' },
          success: { type: 'boolean', example: false },
          data: { type: 'null' },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Request validation failed' },
              details: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    field: { type: 'string' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  security: [{ BearerAuth: [] }],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        security: [],
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { status: { type: 'string', example: 'UP' } },
                },
              },
            },
          },
        },
      },
    },
    '/api/evaluation': {
      get: {
        tags: ['System'],
        summary: 'Candidate evaluation endpoint',
        security: [],
        responses: {
          '200': {
            description: 'Evaluation metadata',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'name', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'alice@example.com' },
                  name: { type: 'string', example: 'Alice Johnson' },
                  password: { type: 'string', minLength: 8, example: 'securepass123' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'User created, JWT returned' },
          '409': { description: 'Email already registered' },
          '422': { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidationError' } } } },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login and get JWT',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'alice@example.com' },
                  password: { type: 'string', example: 'securepass123' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Login successful, JWT returned' },
          '401': { description: 'Invalid credentials' },
        },
      },
    },
    '/api/meetings': {
      post: {
        tags: ['Meetings'],
        summary: 'Create a new meeting',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'meetingDate', 'participants', 'transcript'],
                properties: {
                  title: { type: 'string', example: 'Q4 Planning Session' },
                  meetingDate: { type: 'string', format: 'date-time', example: '2024-12-01T10:00:00Z' },
                  participants: { type: 'array', items: { $ref: '#/components/schemas/Participant' }, minItems: 1 },
                  transcript: { type: 'array', items: { $ref: '#/components/schemas/TranscriptEntry' }, minItems: 1 },
                },
              },
              example: {
                title: 'Q4 Planning Session',
                meetingDate: '2024-12-01T10:00:00Z',
                participants: [
                  { name: 'Alice Johnson', email: 'alice@example.com' },
                  { name: 'Bob Smith', email: 'bob@example.com' },
                ],
                transcript: [
                  { speaker: 'Alice Johnson', text: 'We need to finalize the roadmap by Friday.', timestamp: '00:01:00' },
                  { speaker: 'Bob Smith', text: 'Agreed, I will own the backend tasks.', timestamp: '00:01:30' },
                  { speaker: 'Alice Johnson', text: 'We decided to use PostgreSQL for the database.', timestamp: '00:02:00' },
                ],
              },
            },
          },
        },
        responses: {
          '201': { description: 'Meeting created' },
          '422': { description: 'Validation error' },
        },
      },
      get: {
        tags: ['Meetings'],
        summary: 'List meetings with pagination',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Filter from date (ISO 8601)' },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Filter to date (ISO 8601)' },
        ],
        responses: { '200': { description: 'Paginated meeting list' } },
      },
    },
    '/api/meetings/{id}': {
      get: {
        tags: ['Meetings'],
        summary: 'Get a single meeting with its analysis',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Meeting with analysis', content: { 'application/json': { schema: { $ref: '#/components/schemas/Meeting' } } } },
          '404': { description: 'Meeting not found' },
        },
      },
    },
    '/api/meetings/{id}/analyze': {
      post: {
        tags: ['Meetings'],
        summary: 'Run AI analysis on a meeting transcript',
        description: 'Uses Gemini 1.5 Flash to generate summary, action items, decisions, and follow-up suggestions. All insights are grounded with exact transcript citations.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Analysis complete — action items saved to DB' },
          '404': { description: 'Meeting not found' },
          '409': { description: 'Already analyzed — re-run not allowed without explicit flag' },
        },
      },
    },
    '/api/action-items': {
      post: {
        tags: ['Action Items'],
        summary: 'Manually create an action item',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'assignee'],
                properties: {
                  title: { type: 'string', example: 'Prepare Q4 report' },
                  description: { type: 'string' },
                  assignee: { type: 'string', example: 'Bob Smith' },
                  assigneeEmail: { type: 'string', format: 'email', example: 'bob@example.com' },
                  dueDate: { type: 'string', format: 'date-time', example: '2024-12-15T00:00:00Z' },
                  meetingId: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Action item created' },
          '422': { description: 'Validation error' },
        },
      },
      get: {
        tags: ['Action Items'],
        summary: 'List action items',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED'] } },
          { name: 'assignee', in: 'query', schema: { type: 'string' } },
          { name: 'meetingId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: { '200': { description: 'Paginated action item list' } },
      },
    },
    '/api/action-items/overdue': {
      get: {
        tags: ['Action Items'],
        summary: 'Get overdue action items',
        description: 'Returns items where status != COMPLETED and dueDate < now',
        responses: { '200': { description: 'List of overdue action items' } },
      },
    },
    '/api/action-items/{id}/status': {
      patch: {
        tags: ['Action Items'],
        summary: 'Update action item status',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED'] },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Status updated' },
          '404': { description: 'Action item not found' },
          '422': { description: 'Validation error' },
        },
      },
    },
  },
};

export function setupSwagger(app: Express): void {
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: 'Meeting Intelligence API',
      swaggerOptions: { persistAuthorization: true },
    })
  );
  app.get('/api-docs.json', (_req, res) => res.json(spec));
}
