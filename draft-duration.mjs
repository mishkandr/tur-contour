export const MIN_DRAFT_DAYS = 1;
export const MAX_DRAFT_DAYS = 14;

export function isDraftDuration(value) {
  return Number.isInteger(value) && value >= MIN_DRAFT_DAYS && value <= MAX_DRAFT_DAYS;
}
