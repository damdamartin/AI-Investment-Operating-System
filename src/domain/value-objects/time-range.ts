import { DomainValidationError } from "../../shared/errors.js";

export class TimeRange {
  private constructor(
    public readonly start: Date,
    public readonly end: Date
  ) {}

  static from(start: Date, end: Date): TimeRange {
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new DomainValidationError("TimeRange dates must be valid.");
    }

    if (start >= end) {
      throw new DomainValidationError("TimeRange start must be before end.");
    }

    return new TimeRange(start, end);
  }

  contains(value: Date): boolean {
    return value >= this.start && value <= this.end;
  }
}
