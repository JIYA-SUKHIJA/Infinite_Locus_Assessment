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

const requireAuth = (request: Request): Response | null => {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ') || !authHeader.replace('Bearer ', '').trim()) {
    return HttpResponse.json(
      {
        code: 'UNAUTHORIZED',
        message: 'Authentication token is missing or invalid',
        requestId: `req_unauth_${Date.now()}`
      },
      { status: 401 }
    );
  }
  return null;
};

const handleGetStudents = ({ request }: { request: Request }) => {
  const authError = requireAuth(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const query = url.searchParams.get('q');
  const status = url.searchParams.get('status');
  const isDemoEmptyCohort =
    url.searchParams.get('cohort') === 'empty' ||
    request.headers.get('x-tenant-id') === 'empty-tenant';

  let items = isDemoEmptyCohort ? [] : [mockStudentSummary];
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
      totalPages: items.length > 0 ? 1 : 0,
      hasNextPage: false,
      hasPrevPage: false
    },
    cohortAverageScore: items.length > 0 ? 72.4 : 0
  });
};

const handleGetActivity = ({ request, params }: { request: Request; params: Record<string, string | readonly string[] | undefined> }) => {
  const authError = requireAuth(request);
  if (authError) return authError;

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
};

const handleGetStudentDetail = ({ request, params }: { request: Request; params: Record<string, string | readonly string[] | undefined> }) => {
  const authError = requireAuth(request);
  if (authError) return authError;

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
};

const handlePostAttempt = async ({ params, request }: { params: Record<string, string | readonly string[] | undefined>; request: Request }) => {
  const authError = requireAuth(request);
  if (authError) return authError;

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
};

const handlePatchStudent = async ({ request, params }: { request: Request; params: Record<string, string | readonly string[] | undefined> }) => {
  const authError = requireAuth(request);
  if (authError) return authError;

  const ifMatch = request.headers.get('If-Match');
  const expectedVersion = ifMatch ? parseInt(ifMatch.replace(/"/g, ''), 10) : undefined;

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
};

import { registeredUsersStore } from './seedIdentities';

const handleLogin = async ({ request }: { request: Request }) => {
  const body = (await request.json()) as any;
  const { email, password } = body || {};

  const user = registeredUsersStore.find(
    (u) => u.email.toLowerCase() === (email || '').trim().toLowerCase()
  );

  if (!user || (user.password && user.password !== password)) {
    return HttpResponse.json(
      {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password. Try one of the preset demo credentials.',
        requestId: `req_login_err_${Date.now()}`
      },
      { status: 401 }
    );
  }

  return HttpResponse.json({
    token: user.authToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      tenantId: user.tenantId,
      role: user.role
    }
  });
};

const handleRegister = async ({ request }: { request: Request }) => {
  const body = (await request.json()) as any;
  const { name, email, password, tenantId } = body || {};

  if (!name || !email || !password || !tenantId) {
    return HttpResponse.json(
      {
        code: 'VALIDATION_ERROR',
        message: 'All registration fields are required.',
        requestId: `req_reg_err_${Date.now()}`
      },
      { status: 400 }
    );
  }

  const existing = registeredUsersStore.find(
    (u) => u.email.toLowerCase() === email.trim().toLowerCase()
  );

  if (existing) {
    return HttpResponse.json(
      {
        code: 'USER_ALREADY_EXISTS',
        message: 'An account with this email address already exists.',
        requestId: `req_reg_conflict_${Date.now()}`
      },
      { status: 409 }
    );
  }

  const newUser = {
    id: `user-${Date.now()}`,
    email: email.trim().toLowerCase(),
    password,
    name: name.trim(),
    tenantId,
    tenantLabel: tenantId,
    role: 'evaluator' as const,
    authToken: `demo-token-${Date.now()}`
  };

  registeredUsersStore.push(newUser);

  return HttpResponse.json(
    {
      token: newUser.authToken,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        tenantId: newUser.tenantId,
        role: newUser.role
      }
    },
    { status: 201 }
  );
};

export const handlers = [
  // Auth endpoints (both absolute test URL and relative browser URL)
  http.post('https://api.test.example.com/api/auth/login', handleLogin),
  http.post('/api/auth/login', handleLogin),
  http.post('https://api.test.example.com/api/auth/register', handleRegister),
  http.post('/api/auth/register', handleRegister),

  // GET /api/students (both absolute test URL and relative browser URL)
  http.get('https://api.test.example.com/api/students', handleGetStudents),
  http.get('/api/students', handleGetStudents),

  // GET /api/students/:id/activity
  http.get('https://api.test.example.com/api/students/:id/activity', handleGetActivity),
  http.get('/api/students/:id/activity', handleGetActivity),

  // GET /api/students/:id
  http.get('https://api.test.example.com/api/students/:id', handleGetStudentDetail),
  http.get('/api/students/:id', handleGetStudentDetail),

  // POST /api/students/:id/attempts
  http.post('https://api.test.example.com/api/students/:id/attempts', handlePostAttempt),
  http.post('/api/students/:id/attempts', handlePostAttempt),

  // PATCH /api/students/:id
  http.patch('https://api.test.example.com/api/students/:id', handlePatchStudent),
  http.patch('/api/students/:id', handlePatchStudent)
];
