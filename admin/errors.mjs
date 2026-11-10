export class AppError extends Error {
  constructor(message, { status = 400, details = [] } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message, details = []) {
    super(message, { status: 400, details });
  }
}

export class ConflictError extends AppError {
  constructor(message, details = []) {
    super(message, { status: 409, details });
  }
}

export class BuildError extends AppError {
  constructor(message, output = "") {
    super(message, { status: 422, details: output ? [output] : [] });
    this.output = output;
  }
}

export class PushError extends AppError {
  constructor(message, { retryable = false, details = [] } = {}) {
    super(message, { status: 502, details });
    this.retryable = retryable;
  }
}
