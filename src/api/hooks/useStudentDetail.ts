import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchApi, toApiError } from '../client';
import { StudentDetailResponseSchema, StudentDetailResponse } from '../schemas';
import { QueryState } from '../../types/state';

export function useStudentDetail(studentId: string | null | undefined) {
  const [state, setState] = useState<QueryState<StudentDetailResponse>>({
    status: 'idle',
    data: null,
    error: null
  });

  const sequenceRef = useRef<number>(0);
  const activeAbortControllerRef = useRef<AbortController | null>(null);

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

      const endpoint = `/api/students/${encodeURIComponent(studentId)}`;

      try {
        const responseData = await fetchApi(StudentDetailResponseSchema, endpoint, {
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
    [studentId]
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
