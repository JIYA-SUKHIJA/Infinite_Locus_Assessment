import { http, HttpResponse } from 'msw';

export const mockStudentSummary = {
  id: 'student-123',
  name: 'Alex Rivera',
  email: 'alex.rivera@example.com',
  cohort: '2026-Cohort-A',
  readinessStatus: 'DEVELOPING' as const,
  summaryScore: 68.5,
  completedCompetenciesCount: 3,
  totalCompetenciesCount: 5,
  lastActiveAt: '2026-09-20T10:00:00.000Z'
};

export const mockStudentDetail = {
  id: 'student-123',
  name: 'Alex Rivera',
  email: 'alex.rivera@example.com',
  cohort: '2026-Cohort-A',
  readinessStatus: 'DEVELOPING' as const,
  summaryScore: 68.5,
  competencies: [
    {
      competency: {
        id: 'comp-1',
        name: 'Distributed Systems Design',
        code: 'CS-401',
        category: 'Architecture',
        description: 'Design distributed consensus algorithms'
      },
      latestAttempt: {
        id: 'att-1',
        competencyId: 'comp-1',
        studentId: 'student-123',
        score: 85,
        maxScore: 100,
        passed: true,
        timestamp: '2026-09-18T14:30:00.000Z'
      },
      readiness: 'READY' as const
    }
  ],
  version: 4,
  createdAt: '2026-01-15T09:00:00.000Z',
  updatedAt: '2026-09-18T14:30:00.000Z'
};

export const mockActivityEvent = {
  id: 'act-99',
  studentId: 'student-123',
  eventType: 'ATTEMPT_SUBMITTED' as const,
  payload: { score: 85, competencyId: 'comp-1' },
  actor: 'system',
  timestamp: '2026-09-18T14:30:00.000Z'
};

export const handlers = [
  // GET /api/students
  http.get('https://api.test.example.com/api/students', ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');
    const status = url.searchParams.get('status');

    let items = [mockStudentSummary];
    if (query && !mockStudentSummary.name.toLowerCase().includes(query.toLowerCase())) {
      items = [];
    }
    if (status && mockStudentSummary.readinessStatus !== status) {
      items = [];
    }

    return HttpResponse.json({
      data: items,
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: items.length,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false
      },
      cohortAverageScore: 72.4
    });
  }),

  // GET /api/students/:id/activity (MUST come before /api/students/:id so :id doesn't match :id/activity)
  http.get('https://api.test.example.com/api/students/:id/activity', ({ params }) => {
    return HttpResponse.json({
      data: [
        {
          ...mockActivityEvent,
          studentId: Array.isArray(params.id) ? params.id[0] : params.id
        }
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false
      }
    });
  }),

  // GET /api/students/:id
  http.get('https://api.test.example.com/api/students/:id', ({ params }) => {
    const { id } = params;
    if (id === 'not-found') {
      return HttpResponse.json(
        {
          code: 'STUDENT_NOT_FOUND',
          message: 'Student with ID not-found was not found',
          requestId: 'req_404_test'
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      data: {
        ...mockStudentDetail,
        id: Array.isArray(id) ? id[0] : id
      }
    });
  }),

  // POST /api/students/:id/attempts
  http.post('https://api.test.example.com/api/students/:id/attempts', async ({ params, request }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json(
      {
        data: {
          attempt: {
            id: 'att-new-1',
            competencyId: body.competencyId,
            studentId: Array.isArray(params.id) ? params.id[0] : params.id,
            score: body.score,
            maxScore: body.maxScore,
            passed: body.passed,
            timestamp: '2026-09-23T12:00:00.000Z'
          },
          updatedReadinessStatus: 'READY',
          updatedSummaryScore: 92.0,
          newVersion: 5
        }
      },
      { status: 201 }
    );
  }),

  // PATCH /api/students/:id
  http.patch('https://api.test.example.com/api/students/:id', async ({ request, params }) => {
    const ifMatch = request.headers.get('If-Match');
    const expectedVersion = ifMatch ? parseInt(ifMatch.replace(/"/g, ''), 10) : undefined;

    // Simulate optimistic concurrency conflict if expected version does not match mock version (4)
    if (expectedVersion !== undefined && expectedVersion !== 4) {
      return HttpResponse.json(
        {
          code: 'VERSION_CONFLICT',
          message: `Conflict: Expected version ${expectedVersion} but current version is 4`,
          requestId: 'req_conflict_123'
        },
        { status: 409 }
      );
    }

    const body = (await request.json()) as any;
    return HttpResponse.json({
      data: {
        ...mockStudentDetail,
        id: Array.isArray(params.id) ? params.id[0] : params.id,
        ...body,
        version: 5,
        updatedAt: '2026-09-23T12:00:00.000Z'
      }
    });
  })
];
