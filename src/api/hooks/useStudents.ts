import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchApi, toApiError } from '../client';
import { StudentsListResponseSchema, StudentsListResponse } from '../schemas';
import { ReadinessStatus } from '../../types/domain';
import { QueryState } from '../../types/state';

export interface UseStudentsParams {
  query?: string;
  page?: number;
  pageSize?: number;
  readinessStatus?: ReadinessStatus;
  sortBy?: 'name' | 'readinessStatus' | 'summaryScore' | 'lastActiveAt';
  sortOrder?: 'asc' | 'desc';
}

export function useStudents(params: UseStudentsParams = {}) {
  const [state, setState] = useState<QueryState<StudentsListResponse>>({
    status: 'idle',
    data: null,
    error: null
  });

  // Track the latest request sequence to guard against out-of-order resolution
  const sequenceRef = useRef<number>(0);
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  const { query, page = 1, pageSize = 20, readinessStatus, sortBy, sortOrder } = params;

  const executeFetch = useCallback(
    async () => {
      // Abort previous in-flight request
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      activeAbortControllerRef.current = abortController;
      const currentSeq = ++sequenceRef.current;

      // Distinguish first-load (loading) vs subsequent updates with existing data (refreshing)
      setState((prev) => {
        if (prev.data !== null) {
          return { status: 'refreshing', data: prev.data, error: null };
        }
        return { status: 'loading', data: null, error: null };
      });

      const searchParams = new URLSearchParams();
      if (query) searchParams.set('q', query);
      searchParams.set('page', String(page));
      searchParams.set('pageSize', String(pageSize));
      if (readinessStatus) searchParams.set('status', readinessStatus);
      if (sortBy) searchParams.set('sortBy', sortBy);
      if (sortOrder) searchParams.set('sortOrder', sortOrder);

      const endpoint = `/api/students?${searchParams.toString()}`;

      try {
        const responseData = await fetchApi(StudentsListResponseSchema, endpoint, {
          signal: abortController.signal
        });

        // Discard result if superseded by a newer request
        if (currentSeq !== sequenceRef.current) {
          return;
        }

        setState({
          status: 'success',
          data: responseData,
          error: null
        });
      } catch (err: unknown) {
        // Ignore aborted requests (either from cleanup or supersession)
        if (abortController.signal.aborted || currentSeq !== sequenceRef.current) {
          return;
        }

        setState({
          status: 'error',
          data: null,
          error: toApiError(err)
        });
      } finally {
        if (activeAbortControllerRef.current === abortController) {
          activeAbortControllerRef.current = null;
        }
      }
    },
    [query, page, pageSize, readinessStatus, sortBy, sortOrder]
  );

  useEffect(() => {
    void executeFetch();

    return () => {
      // Cleanup on unmount or param change
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort();
      }
    };
  }, [executeFetch]);

  const refetch = useCallback(() => {
    return executeFetch();
  }, [executeFetch]);

  return {
    ...state,
    refetch
  };
}
