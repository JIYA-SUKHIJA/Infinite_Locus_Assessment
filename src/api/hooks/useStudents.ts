import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchApi, toApiError } from '../client';
import { StudentsListResponseSchema, StudentsListResponse } from '../schemas';
import { getApiConfig, subscribeApiConfig } from '../config';
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

  // Track the active tenant and request sequence to guard against cross-tenant leaks and out-of-order resolution
  const activeTenantRef = useRef<string | null>(getApiConfig().tenantId);
  const sequenceRef = useRef<number>(0);
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  const { query, page = 1, pageSize = 20, readinessStatus, sortBy, sortOrder } = params;

  const executeFetch = useCallback(
    async (isTenantSwitch = false) => {
      // Abort previous in-flight request
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      activeAbortControllerRef.current = abortController;
      const currentSeq = ++sequenceRef.current;
      const currentTenantId = getApiConfig().tenantId;

      // SECURITY OVER UX: Clear data immediately to prevent cross-tenant data leaks.
      // While Phase 2/3 uses status: 'refreshing' with preserved prev.data to avoid layout shifts during
      // parameter changes (e.g. search/pagination), cross-tenant transitions MUST NEVER preserve prev.data.
      // Showing Tenant A data while Tenant B is loading (or if Tenant B fails) is a critical security vulnerability.
      if (isTenantSwitch) {
        setState({ status: 'loading', data: null, error: null });
      } else {
        setState((prev) => {
          if (prev.data !== null) {
            return { status: 'refreshing', data: prev.data, error: null };
          }
          return { status: 'loading', data: null, error: null };
        });
      }

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

        // Discard result if superseded by a newer request OR if tenant switched during in-flight fetch
        if (currentSeq !== sequenceRef.current || currentTenantId !== getApiConfig().tenantId) {
          return;
        }

        setState({
          status: 'success',
          data: responseData,
          error: null
        });
      } catch (err: unknown) {
        // Ignore aborted requests (either from cleanup or supersession/tenant switch)
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
    [query, page, pageSize, readinessStatus, sortBy, sortOrder]
  );

  // Initial fetch and parameter changes
  useEffect(() => {
    void executeFetch(false);

    return () => {
      // Cleanup on unmount or param change
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
        void executeFetch(true);
      }
    });

    return () => {
      // Unsubscribe listener on unmount to prevent memory leaks
      unsubscribe();
    };
  }, [executeFetch]);

  const refetch = useCallback(() => {
    return executeFetch(false);
  }, [executeFetch]);

  return {
    ...state,
    refetch
  };
}
