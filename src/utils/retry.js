import { setTimeout as sleep } from 'node:timers/promises';

export class RetryConfig {
  constructor({
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    jitter = true,
    timeout = null,
    onRetry = null,
    shouldRetry = null,
  } = {}) {
    this.maxAttempts = maxAttempts;
    this.baseDelay = baseDelay;
    this.maxDelay = maxDelay;
    this.backoffFactor = backoffFactor;
    this.jitter = jitter;
    this.timeout = timeout;
    this.onRetry = onRetry;
    this.shouldRetry = shouldRetry;
  }
}

export class RetryAttempt {
  constructor(attemptNumber, delay, error = null, startTime = Date.now()) {
    this.attemptNumber = attemptNumber;
    this.delay = delay;
    this.error = error;
    this.startTime = startTime;
    this.endTime = null;
  }

  complete(error = null) {
    this.endTime = Date.now();
    this.error = error;
    return this;
  }

  get duration() {
    return this.endTime ? this.endTime - this.startTime : Date.now() - this.startTime;
  }
}

export class RetryContext {
  constructor(operation, config) {
    this.operation = operation;
    this.config = config;
    this.attempts = [];
    this.startTime = Date.now();
  }

  addAttempt(attempt) {
    this.attempts.push(attempt);
  }

  get totalDuration() {
    return Date.now() - this.startTime;
  }

  get lastAttempt() {
    return this.attempts[this.attempts.length - 1] || null;
  }
}

function calculateDelay(attemptNumber, baseDelay, backoffFactor, maxDelay, jitter = true) {
  let delay = baseDelay * Math.pow(backoffFactor, attemptNumber - 1);
  delay = Math.min(delay, maxDelay);

  if (jitter) {
    // Add ±25% jitter to prevent thundering herd
    const jitterRange = delay * 0.25;
    const randomJitter = (Math.random() - 0.5) * 2 * jitterRange;
    delay = Math.max(0, delay + randomJitter);
  }

  return Math.floor(delay);
}

function defaultShouldRetry(error, attemptNumber, config) {
  // Don't retry if we've exceeded max attempts
  if (attemptNumber >= config.maxAttempts) {
    return false;
  }

  // Use custom error system to determine retryability
  // if (!isRetryable(error)) {
  //   return false;
  // }
  if (error.critical) {
    return false;
  }

  return true;
}

async function withTimeout(promise, timeoutMs, timeoutError) {
  if (!timeoutMs) return promise;

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(timeoutError), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

export async function retry(fn, config = {}) {
  const retryConfig = config instanceof RetryConfig ? config : new RetryConfig(config);
  const context = new RetryContext(fn.name || 'anonymous', retryConfig);

  let lastError;

  for (let attemptNumber = 1; attemptNumber <= retryConfig.maxAttempts; attemptNumber++) {
    const attempt = new RetryAttempt(attemptNumber, 0);
    context.addAttempt(attempt);

    try {
      // Execute the function with optional timeout
      const timeoutError = new Error(`Operation timed out after ${retryConfig.timeout}ms`);
      const result = await withTimeout(fn(), retryConfig.timeout, timeoutError);

      attempt.complete();
      return result;
    } catch (error) {
      lastError = error;
      attempt.complete(error);

      // Determine if we should retry
      const shouldRetry = retryConfig.shouldRetry
        ? retryConfig.shouldRetry(error, attemptNumber, retryConfig)
        : defaultShouldRetry(error, attemptNumber, retryConfig);

      // If this is the last attempt or we shouldn't retry, throw the error
      if (!shouldRetry || attemptNumber >= retryConfig.maxAttempts) {
        // Enhance error with retry context
        if (error instanceof Error) {
          error.retryContext = {
            totalAttempts: attemptNumber,
            totalDuration: context.totalDuration,
            attempts: context.attempts.map((a) => ({
              number: a.attemptNumber,
              duration: a.duration,
              delay: a.delay,
              error: a.error?.message,
            })),
          };
        }
        throw error;
      }

      // Calculate delay for next attempt
      const delay = calculateDelay(
        attemptNumber,
        retryConfig.baseDelay,
        retryConfig.backoffFactor,
        retryConfig.maxDelay,
        retryConfig.jitter,
      );
      attempt.delay = delay;

      // Call retry callback if provided
      if (retryConfig.onRetry) {
        try {
          await retryConfig.onRetry(error, attemptNumber, context);
        } catch (callbackError) {
          console.warn('Retry callback failed:', callbackError);
        }
      }

      // Wait before retrying
      if (delay > 0) {
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

// Convenience function for creating retry configurations
export function createRetryConfig(overrides = {}) {
  return new RetryConfig(overrides);
}

// Pre-configured retry strategies
export const RetryStrategies = {
  // Quick retries for transient network issues
  NETWORK: new RetryConfig({
    maxAttempts: 3,
    baseDelay: 500,
    maxDelay: 5000,
    backoffFactor: 2,
  }),

  // Patient retries for database operations
  DATABASE: new RetryConfig({
    maxAttempts: 5,
    baseDelay: 1000,
    maxDelay: 15000,
    backoffFactor: 1.5,
  }),

  // Conservative retries for AI operations (rate limiting)
  AI_SERVICE: new RetryConfig({
    maxAttempts: 4,
    baseDelay: 2000,
    maxDelay: 30000,
    backoffFactor: 2,
  }),

  // Aggressive retries for critical operations
  CRITICAL: new RetryConfig({
    maxAttempts: 7,
    baseDelay: 100,
    maxDelay: 10000,
    backoffFactor: 1.8,
  }),

  // Simple retry for non-critical operations
  SIMPLE: new RetryConfig({
    maxAttempts: 2,
    baseDelay: 1000,
    maxDelay: 3000,
    backoffFactor: 2,
    jitter: false,
  }),
};

// Higher-order function to create retry-enabled versions of async functions
export function withRetry(asyncFn, config = RetryStrategies.NETWORK) {
  return async function (...args) {
    return retry(() => asyncFn.apply(this, args), config);
  };
}
