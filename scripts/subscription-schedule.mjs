export function getNextShanghaiRun(now, hour) {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error('Subscription daily hour must be an integer from 0 to 23');
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const date = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const hourText = String(hour).padStart(2, '0');
  let candidate = new Date(`${date.year}-${date.month}-${date.day}T${hourText}:00:00+08:00`);
  if (candidate.getTime() <= now.getTime()) {
    candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
  }
  return candidate;
}

export function shouldRunOnStart(now, hour) {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error('Subscription daily hour must be an integer from 0 to 23');
  }
  const currentHour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(now));
  return currentHour >= hour;
}
