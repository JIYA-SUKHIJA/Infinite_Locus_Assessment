import { useState, useCallback } from 'react';
import { fetchApi, toApiError } from '../client';
import { PatchStudentResponseSchema, PatchStudentResponse } from '../schemas';
import { StudentPatchInput } from '../../types/domain';
import { MutationState } from '../../types/state';

export interface PatchStudentOptions {
  expectedVersion: number;
}

export function usePatchStudent() {
  const [state, setState] = useState<MutationState<PatchStudentResponse['data']>>({
    status: 'idle',
    data: null,
    error: null
  });

  const patchStudent = useCallback(
    async (
      studentId: string,
      payload: StudentPatchInput,
      options: PatchStudentOptions
    ): Promise<PatchStudentResponse['data'] | null> => {
      setState({ status: 'loading', data: null, error: null });

      const endpoint = `/api/students/${encodeURIComponent(studentId)}`;

      try {
        const responseData = await fetchApi(PatchStudentResponseSchema, endpoint, {
          method: 'PATCH',
          body: payload,
          expectedVersion: options.expectedVersion // Sends standard HTTP If-Match header
        });

        setState({
          status: 'success',
          data: responseData.data,
          error: null
        });

        return responseData.data;
      } catch (err: unknown) {
        const apiError = toApiError(err);

        // Optimistic concurrency conflict check (HTTP 409)
        if (apiError.isConflict()) {
          setState({
            status: 'conflict',
            data: null,
            error: apiError,
            message: apiError.message || 'The student record has been updated by another user. Please refresh and retry.'
          });
          return null;
        }

        setState({
          status: 'error',
          data: null,
          error: apiError
        });
        return null;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({ status: 'idle', data: null, error: null });
  }, []);

  return {
    ...state,
    patchStudent,
    reset
  };
}
