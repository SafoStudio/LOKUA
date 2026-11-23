export class EventDomainError extends Error {
  constructor(message: string) {
    super(message);
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

export class InvalidEventAgeRestrictionError extends EventDomainError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEventAgeRestrictionError';
  }
}
