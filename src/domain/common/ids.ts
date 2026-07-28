import { DomainValidationError } from "../../shared/errors.js";

export type EntityId = string;

export function requireEntityId(value: string, fieldName: string): EntityId {
  if (value.trim() === "") {
    throw new DomainValidationError(`${fieldName} is required.`);
  }

  return value;
}
