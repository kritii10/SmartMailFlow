export const getDelayMs = (scheduledAt: Date): number => {
  return Math.max(scheduledAt.getTime() - Date.now(), 0);
};

export const startOfCurrentHour = (timestamp = Date.now()): number => {
  const date = new Date(timestamp);
  date.setMinutes(0, 0, 0);
  return date.getTime();
};

export const nextHourStart = (timestamp = Date.now()): Date => {
  const date = new Date(startOfCurrentHour(timestamp) + 60 * 60 * 1000);
  return date;
};

