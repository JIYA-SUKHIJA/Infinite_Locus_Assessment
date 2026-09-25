import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchApi, toApiError } from '../client';
import { StudentDetailResponseSchema, StudentDetailResponse } from '../schemas';
import { getApiConfig, subscribeApiConfig } from '../config';
import { QueryState } from '../../types/state';

export function useStudentDetail(studentId: string | null | undefined) {
  const [state, setState] = useState<QueryState<StudentDetailResponse>>({
    status: 'idle',
    data: null,
    error: null
  });

  const activeTenantRef = useRef<string | null>(getApiConfig().tenantId);
  const sequenceRef = useRef<number>(0);
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  const executeFetch = useCallback(
    async (isRefresh = false, isTenantSwitch = false) => {
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
      const currentTenantId = getApiConfig().tenantId;

      // SECURITY OVER UX: Clear data immediately to prevent cross-tenant data leaks.
      // While Phase 2/3 uses status: 'refreshing' with preserved prev.data to avoid layout shifts during
      // parameter changes, cross-tenant transitions MUST NEVER preserve prev.data.
      // Showing Tenant A details under Tenant B is a critical cross-tenant data leak vulnerability.
      if (isTenantSwitch) {
        setState({ status: 'loading', data: null, error: null });
      } else {
        setState((prev) => {
          if (isRefresh && prev.data !== null) {
            return { status: 'refreshing', data: prev.data, error: null };
          }
          return { status: 'loading', data: null, error: null };
        });
      }

      const endpoint = `/api/students/${encodeURIComponent(studentId)}`;

      try {
        const responseData = await fetchApi(StudentDetailResponseSchema, endpoint, {
          signal: abortController.signal
        });

        if (currentSeq !== sequenceRef.current || currentTenantId !== getApiConfig().tenantId) {
          return;
        }

        setState({
          status: 'success',
          data: responseData,
          error: null
        });
      } catch (err: unknown) {
        if (
          abortController.signal.aborted ||
          currentSeq !== sequenceRef.current ||
          currentTenantId !== getApiConfig().tenantId
        ) {
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
    void executeFetch(false, false);

    return () => {
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort();
      }
    };
  }, [executeFetch]);

  // Subscribe to tenant config changes to guarantee immediate cancellation and clean re-fetch
  useEffect(() => {
    const unsubscribe = subscribeApiConfig((newConfig) => {
      if (newConfig.tenantId !== activeTenantRef.current) {
        activeTenantRef.current = newConfig.tenantId;
        void executeFetch(false, true);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [executeFetch]);

  const refetch = useCallback(() => {
    return executeFetch(true, false);
  }, [executeFetch]);

  return {
    ...state,
    refetch
  };
}
