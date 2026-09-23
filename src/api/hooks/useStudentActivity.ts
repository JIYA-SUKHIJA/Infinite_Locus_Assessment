import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchApi, toApiError } from '../client';
import { StudentActivityResponseSchema, StudentActivityResponse } from '../schemas';
import { QueryState } from '../../types/state';

export interface UseStudentActivityParams {
  page?: number;
  pageSize?: number;
}

export function useStudentActivity(
  studentId: string | null | undefined,
  params: UseStudentActivityParams = {}
) {
  const [state, setState] = useState<QueryState<StudentActivityResponse>>({
    status: 'idle',
    data: null,
    error: null
  });

  const sequenceRef = useRef<number>(0);
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  const { page = 1, pageSize = 20 } = params;

  const executeFetch = useCallback(
    async (isRefresh = false) => {
      if (!studentId) {
        setState({ status: 'idle', data: null, error: null });
        return;
      }

      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      activeAbortControllerRef.current = abortController;
      const currentSeq = ++sequenceRef.current;

      setState((prev) => {
        if (isRefresh && prev.data !== null) {
          return { status: 'refreshing', data: prev.data, error: null };
        }
        return { status: 'loading', data: null, error: null };
      });

      const searchParams = new URLSearchParams();
      searchParams.set('page', String(page));
      searchParams.set('pageSize', String(pageSize));

      const endpoint = `/api/students/${encodeURIComponent(studentId)}/activity?${searchParams.toString()}`;

      try {
        const responseData = await fetchApi(StudentActivityResponseSchema, endpoint, {
          signal: abortController.signal
        });

        if (currentSeq !== sequenceRef.current) {
          return;
        }

        setState({
          status: 'success',
          data: responseData,
          error: null
        });
      } catch (err: unknown) {
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
    [studentId, page, pageSize]
  );

  useEffect(() => {
    void executeFetch(false);

    return () => {
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort();
      }
    };
  }, [executeFetch]);

  const refetch = useCallback(() => {
    return executeFetch(true);
  }, [executeFetch]);

  return {
    ...state,
    refetch
  };
}
