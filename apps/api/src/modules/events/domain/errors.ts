import { AppError } from '../../../common/index.js';

export class EventDomainError extends AppError {
  constructor(message: string) {
    super(message, 422);
    this.name = 'EventDomainError';
  }
}

export class InvalidEventDatesError extends EventDomainError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEventDatesError';
  }
}

export class InvalidEventFormatError extends EventDomainError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEventFormatError';
  }
}

export class InvalidEventPriceError extends EventDomainError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEventPriceError';
  }
}
