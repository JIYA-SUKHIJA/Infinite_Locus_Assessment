import { useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ReadinessStatus } from '../../types/domain';
import { UseStudentsParams } from '../../api/hooks/useStudents';

const VALID_STATUSES: readonly ReadinessStatus[] = [
  'READY',
  'NEARLY_READY',
  'DEVELOPING',
  'NEEDS_PREPARATION',
  'INCOMPLETE'
];

const VALID_SORT_COLUMNS: readonly NonNullable<UseStudentsParams['sortBy']>[] = [
  'name',
  'readinessStatus',
  'summaryScore',
  'lastActiveAt'
];

export interface StudentsQueryParams {
  query: string;
  readinessStatus: ReadinessStatus | undefined;
  sortBy: NonNullable<UseStudentsParams['sortBy']>;
  sortOrder: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export function useStudentsQueryParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse and validate query params with safe fallbacks
  const params: StudentsQueryParams = useMemo(() => {
    const rawQuery = searchParams.get('q') ?? '';
    const rawStatus = searchParams.get('status');
    const rawSortBy = searchParams.get('sortBy');
    const rawSortOrder = searchParams.get('sortOrder');
    const rawPage = searchParams.get('page');
    const rawPageSize = searchParams.get('pageSize');

    const readinessStatus: ReadinessStatus | undefined =
      rawStatus && VALID_STATUSES.includes(rawStatus as ReadinessStatus)
        ? (rawStatus as ReadinessStatus)
        : undefined;

    const sortBy: NonNullable<UseStudentsParams['sortBy']> =
      rawSortBy && VALID_SORT_COLUMNS.includes(rawSortBy as NonNullable<UseStudentsParams['sortBy']>)
        ? (rawSortBy as NonNullable<UseStudentsParams['sortBy']>)
        : 'name';

    const sortOrder: 'asc' | 'desc' = rawSortOrder === 'desc' ? 'desc' : 'asc';

    const parsedPage = rawPage ? parseInt(rawPage, 10) : 1;
    const page = Number.isInteger(parsedPage) && parsedPage >= 1 ? parsedPage : 1;

    const parsedPageSize = rawPageSize ? parseInt(rawPageSize, 10) : 20;
    const pageSize =
      Number.isInteger(parsedPageSize) && parsedPageSize >= 1 && parsedPageSize <= 100
        ? parsedPageSize
        : 20;

    return {
      query: rawQuery,
      readinessStatus,
      sortBy,
      sortOrder,
      page,
      pageSize
    };
  }, [searchParams]);

  // Hook-ready parameter object
  const useStudentsParams: UseStudentsParams = useMemo(() => {
    const result: UseStudentsParams = {
      page: params.page,
      pageSize: params.pageSize,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder
    };

    if (params.query.trim()) {
      result.query = params.query.trim();
    }
    if (params.readinessStatus) {
      result.readinessStatus = params.readinessStatus;
    }

    return result;
  }, [params]);

  // Updaters that synchronize to URL search params
  const updateUrl = useCallback(
    (updater: (prev: URLSearchParams) => URLSearchParams) => {
      setSearchParams((current) => {
        const next = updater(new URLSearchParams(current));
        return next;
      });
    },
    [setSearchParams]
  );

  const setQuery = useCallback(
    (newQuery: string) => {
      updateUrl((next) => {
        const trimmed = newQuery.trim();
        if (trimmed) {
          next.set('q', trimmed);
        } else {
          next.delete('q');
        }
        next.set('page', '1'); // Reset to page 1 on search change
        return next;
      });
    },
    [updateUrl]
  );

  const setStatus = useCallback(
    (status: ReadinessStatus | 'ALL') => {
      updateUrl((next) => {
        if (status === 'ALL') {
          next.delete('status');
        } else if (VALID_STATUSES.includes(status)) {
          next.set('status', status);
        }
        next.set('page', '1'); // Reset to page 1 on filter change
        return next;
      });
    },
    [updateUrl]
  );

  const toggleSort = useCallback(
    (column: NonNullable<UseStudentsParams['sortBy']>) => {
      updateUrl((next) => {
        const currentSortBy = next.get('sortBy') ?? 'name';
        const currentSortOrder = next.get('sortOrder') ?? 'asc';

        if (currentSortBy === column) {
          // Toggle order
          next.set('sortOrder', currentSortOrder === 'asc' ? 'desc' : 'asc');
        } else {
          next.set('sortBy', column);
          next.set('sortOrder', 'asc');
        }
        next.set('page', '1'); // Reset to page 1 on sort change
        return next;
      });
    },
    [updateUrl]
  );

  const setPage = useCallback(
    (newPage: number) => {
      if (newPage >= 1) {
        updateUrl((next) => {
          next.set('page', String(newPage));
          return next;
        });
      }
    },
    [updateUrl]
  );

  const resetAll = useCallback(() => {
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  return {
    params,
    useStudentsParams,
    setQuery,
    setStatus,
    toggleSort,
    setPage,
    resetAll
  };
}
