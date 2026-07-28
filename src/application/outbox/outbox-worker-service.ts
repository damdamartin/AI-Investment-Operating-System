export type OutboxEventStatus = "PENDING" | "PROCESSING" | "PROCESSED" | "FAILED" | "DEAD_LETTER";

export interface OutboxEventRecord {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  status: OutboxEventStatus;
  attemptCount: number;
  nextAttemptAt: Date | undefined;
  lockedBy: string | undefined;
  lockedAt: Date | undefined;
  lastError: string | undefined;
  createdAt: Date;
  processedAt: Date | undefined;
}

export interface OutboxWorkerPolicy {
  maxAttempts: number;
  retryDelayMs: number;
  lockTimeoutMs: number;
  nonRetryableErrorCodes: string[];
}

export interface OutboxProcessingFailure {
  code: string;
  message: string;
  unknownBrokerState?: boolean | undefined;
}

export type OutboxProcessingResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: OutboxProcessingFailure;
    };

export interface OutboxWorkerRunInput {
  events: OutboxEventRecord[];
  workerId: string;
  now: Date;
  policy: OutboxWorkerPolicy;
  process: (event: OutboxEventRecord) => Promise<OutboxProcessingResult>;
}

export interface OutboxWorkerRunResult {
  events: OutboxEventRecord[];
  processedEventIds: string[];
  skippedEventIds: string[];
  deadLetterEventIds: string[];
  safetyType: "OUTBOX_WORKER_STATE_TRANSITION_ONLY";
}

export const defaultOutboxWorkerPolicy: OutboxWorkerPolicy = {
  maxAttempts: 3,
  retryDelayMs: 60_000,
  lockTimeoutMs: 300_000,
  nonRetryableErrorCodes: ["UNKNOWN_BROKER_STATE", "DUPLICATE_ORDER_RISK"]
};

export class OutboxWorkerService {
  async run(input: OutboxWorkerRunInput): Promise<OutboxWorkerRunResult> {
    const events = input.events.map(cloneEvent);
    const processedEventIds: string[] = [];
    const skippedEventIds: string[] = [];
    const deadLetterEventIds: string[] = [];
    const event = selectNextEvent(events, input.now, input.policy);

    if (!event) {
      return {
        events,
        processedEventIds,
        skippedEventIds: events.map((item) => item.id),
        deadLetterEventIds,
        safetyType: "OUTBOX_WORKER_STATE_TRANSITION_ONLY"
      };
    }

    const locked = lockEvent(event, input.workerId, input.now, input.policy);
    if (!locked) {
      skippedEventIds.push(event.id);
      return {
        events,
        processedEventIds,
        skippedEventIds,
        deadLetterEventIds,
        safetyType: "OUTBOX_WORKER_STATE_TRANSITION_ONLY"
      };
    }

    const result = await input.process(event);
    if (result.ok) {
      markProcessed(event, input.now);
      processedEventIds.push(event.id);
    } else if (shouldDeadLetter(result.error, event.attemptCount, input.policy)) {
      markDeadLetter(event, result.error, input.now);
      deadLetterEventIds.push(event.id);
    } else {
      markFailed(event, result.error, input.now, input.policy);
    }

    return {
      events,
      processedEventIds,
      skippedEventIds,
      deadLetterEventIds,
      safetyType: "OUTBOX_WORKER_STATE_TRANSITION_ONLY"
    };
  }
}

function selectNextEvent(
  events: OutboxEventRecord[],
  now: Date,
  policy: OutboxWorkerPolicy
): OutboxEventRecord | undefined {
  return [...events]
    .filter((event) => isEligible(event, now, policy))
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())[0];
}

function isEligible(event: OutboxEventRecord, now: Date, policy: OutboxWorkerPolicy): boolean {
  if (event.status === "PENDING") return !event.nextAttemptAt || event.nextAttemptAt <= now;
  if (event.status === "FAILED") return !event.nextAttemptAt || event.nextAttemptAt <= now;
  if (event.status !== "PROCESSING") return false;
  if (!event.lockedAt) return true;
  return now.getTime() - event.lockedAt.getTime() > policy.lockTimeoutMs;
}

function lockEvent(event: OutboxEventRecord, workerId: string, now: Date, policy: OutboxWorkerPolicy): boolean {
  if (event.status === "PROCESSING" && event.lockedAt && now.getTime() - event.lockedAt.getTime() <= policy.lockTimeoutMs) {
    return false;
  }

  event.status = "PROCESSING";
  event.lockedBy = workerId;
  event.lockedAt = now;
  event.attemptCount += 1;
  return true;
}

function markProcessed(event: OutboxEventRecord, now: Date): void {
  event.status = "PROCESSED";
  event.processedAt = now;
  event.nextAttemptAt = undefined;
  event.lockedBy = undefined;
  event.lockedAt = undefined;
  event.lastError = undefined;
}

function markFailed(
  event: OutboxEventRecord,
  error: OutboxProcessingFailure,
  now: Date,
  policy: OutboxWorkerPolicy
): void {
  event.status = "FAILED";
  event.nextAttemptAt = new Date(now.getTime() + policy.retryDelayMs);
  event.lockedBy = undefined;
  event.lockedAt = undefined;
  event.lastError = safeErrorSummary(error);
}

function markDeadLetter(event: OutboxEventRecord, error: OutboxProcessingFailure, now: Date): void {
  event.status = "DEAD_LETTER";
  event.nextAttemptAt = undefined;
  event.lockedBy = undefined;
  event.lockedAt = undefined;
  event.lastError = safeErrorSummary(error);
  event.processedAt = now;
}

function shouldDeadLetter(error: OutboxProcessingFailure, attemptCount: number, policy: OutboxWorkerPolicy): boolean {
  if (error.unknownBrokerState) return true;
  if (policy.nonRetryableErrorCodes.includes(error.code)) return true;
  return attemptCount >= policy.maxAttempts;
}

function safeErrorSummary(error: OutboxProcessingFailure): string {
  return `${error.code}:${error.message}`.slice(0, 500);
}

function cloneEvent(event: OutboxEventRecord): OutboxEventRecord {
  return {
    ...event,
    payload: { ...event.payload },
    nextAttemptAt: event.nextAttemptAt ? new Date(event.nextAttemptAt) : undefined,
    lockedAt: event.lockedAt ? new Date(event.lockedAt) : undefined,
    createdAt: new Date(event.createdAt),
    processedAt: event.processedAt ? new Date(event.processedAt) : undefined
  };
}
