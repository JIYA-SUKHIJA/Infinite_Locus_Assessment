import { useState, useCallback } from 'react';
import { fetchApi, toApiError } from '../client';
import { CreateAttemptResponseSchema, CreateAttemptResponse } from '../schemas';
import { CreateAttemptInput } from '../../types/domain';
import { MutationState } from '../../types/state';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback UUID generation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface SubmitAttemptOptions {
  idempotencyKey?: string;
}

export function useSubmitAttempt() {
  const [state, setState] = useState<MutationState<CreateAttemptResponse['data']>>({
    status: 'idle',
    data: null,
    error: null
  });

  const submitAttempt = useCallback(
    async (
      studentId: string,
      payload: CreateAttemptInput,
      options: SubmitAttemptOptions = {}
    ): Promise<CreateAttemptResponse['data'] | null> => {
      setState({ status: 'loading', data: null, error: null });

      // Enforce an idempotency key per submission to prevent duplicate processing
      const idempotencyKey = options.idempotencyKey ?? generateUUID();

      const endpoint = `/api/students/${encodeURIComponent(studentId)}/attempts`;

      try {
        const responseData = await fetchApi(CreateAttemptResponseSchema, endpoint, {
          method: 'POST',
          body: payload,
          idempotencyKey
        });

        setState({
          status: 'success',
          data: responseData.data,
          error: null
        });

        return responseData.data;
      } catch (err: unknown) {
        const apiError = toApiError(err);
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
    submitAttempt,
    reset
  };
}
