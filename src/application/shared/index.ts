// Core infrastructure for error handling and retry logic

export { DBTransaction } from "../../persistence/db-transaction.js";
export type { TransactionOptions } from "../../persistence/db-transaction.js";

export {
  ErrorLogger,
  type ErrorSeverity,
  type ErrorMetadata,
  type LoggedError,
  type ErrorNotificationHandler
} from "./error-logger.js";

export {
  RetryHandler,
  isTransientError,
  type RetryHandlerOptions,
  type RetryMetrics,
  type RetryPredicate
} from "./retry-handler.js";
