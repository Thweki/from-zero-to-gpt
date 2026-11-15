export interface StudySession {
  elapsedMs: number;
  startedAt: number | null;
}

export const emptySession: StudySession = {elapsedMs: 0, startedAt: null};

export function elapsedTime(session: StudySession, now: number): number {
  return session.elapsedMs + (session.startedAt === null ? 0 : Math.max(0, now - session.startedAt));
}

export function startSession(session: StudySession, now: number): StudySession {
  return session.startedAt === null ? {...session, startedAt: now} : session;
}

export function pauseSession(session: StudySession, now: number): StudySession {
  return session.startedAt === null ? session : {elapsedMs: elapsedTime(session, now), startedAt: null};
}

export function formatElapsedTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map(value => String(value).padStart(2, '0')).join(':');
}
