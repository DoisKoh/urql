import { ExecutionResult, Operation, OperationResult } from '../types';
import { CombinedError } from './error';

/** Converts the `ExecutionResult` received for a given `Operation` to an `OperationResult`.
 *
 * @param operation - The {@link Operation} for which the API’s result is for.
 * @param result - The GraphQL API’s {@link ExecutionResult}.
 * @param response - Optionally, a raw object representing the API’s result (Typically a {@link Response}).
 * @returns An {@link OperationResult}.
 *
 * @remarks
 * This utility can be used to create {@link OperationResult | OperationResults} in the shape
 * that `urql` expects and defines, and should be used rather than creating the results manually.
 *
 * @throws
 * If no data, or errors are contained within the result, or the result is instead an incremental
 * response containing a `path` property, a “No Content” error is thrown.
 *
 * @see {@link ExecutionResult} for the type definition of GraphQL API results.
 */
export const makeResult = (
  operation: Operation,
  result: ExecutionResult,
  response?: any
): OperationResult => {
  if ((!('data' in result) && !('errors' in result)) || 'path' in result) {
    throw new Error('No Content');
  }

  return {
    operation,
    data: result.data,
    error: Array.isArray(result.errors)
      ? new CombinedError({
          graphQLErrors: result.errors,
          response,
        })
      : undefined,
    extensions:
      (typeof result.extensions === 'object' && result.extensions) || undefined,
    hasNext: !!result.hasNext,
  };
};

/** Merges an incrementally delivered `ExecutionResult` into a previous `OperationResult`.
 *
 * @param prevResult - The {@link OperationResult} that preceded this result.
 * @param path - The GraphQL API’s {@link ExecutionResult} that should be patching the `prevResult`.
 * @param response - Optionally, a raw object representing the API’s result (Typically a {@link Response}).
 * @returns A new {@link OperationResult} patched with the incremental result.
 *
 * @remarks
 * This utility should be used to merge subsequent {@link ExecutionResult | ExecutionResults} of
 * incremental responses into a prior {@link OperationResult}.
 *
 * When directives like `@defer`, `@stream`, and `@live` are used, GraphQL may deliver new
 * results that modify previous results. In these cases, it'll set a `path` property to modify
 * the result it sent last. This utility is built to handle these cases and merge these payloads
 * into existing {@link OperationResult | OperationResults}.
 *
 * @see {@link ExecutionResult} for the type definition of GraphQL API results.
 */
export const mergeResultPatch = (
  prevResult: OperationResult,
  patch: ExecutionResult,
  response?: any
): OperationResult => {
  const result = { ...prevResult };
  result.hasNext = !!patch.hasNext;

  if (!('path' in patch)) {
    if ('data' in patch) result.data = patch.data;
    return result;
  }

  if (Array.isArray(patch.errors)) {
    result.error = new CombinedError({
      graphQLErrors: result.error
        ? [...result.error.graphQLErrors, ...patch.errors]
        : patch.errors,
      response,
    });
  }

  let part: Record<string, any> | Array<any> = (result.data = {
    ...result.data,
  });

  let i = 0;
  let prop: string | number;
  while (i < patch.path.length) {
    prop = patch.path[i++];
    part = part[prop] = Array.isArray(part[prop])
      ? [...part[prop]]
      : { ...part[prop] };
  }

  Object.assign(part, patch.data);
  return result;
};

/** Creates an `OperationResult` containing a network error for requests that encountered unexpected errors.
 *
 * @param operation - The {@link Operation} for which the API’s result is for.
 * @param error - The network-like error that prevented an API result from being delivered.
 * @param response - Optionally, a raw object representing the API’s result (Typically a {@link Response}).
 * @returns An {@link OperationResult} containing only a {@link CombinedError}.
 *
 * @remarks
 * This utility can be used to create {@link OperationResult | OperationResults} in the shape
 * that `urql` expects and defines, and should be used rather than creating the results manually.
 * This function should be used for when the {@link CombinedError.networkError} property is
 * populated and no GraphQL execution actually occurred.
 */
export const makeErrorResult = (
  operation: Operation,
  error: Error,
  response?: any
): OperationResult => ({
  operation,
  data: undefined,
  error: new CombinedError({
    networkError: error,
    response,
  }),
  extensions: undefined,
});
