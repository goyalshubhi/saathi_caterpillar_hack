// Machine Memory briefing guard: notes for the machine are never skipped silently.
//
// Every task-facing screen (morning, pre-task, in-task) calls `await guard.ensureBriefed(machineId)`
// when it loads, before its own lines. Notes not yet spoken in this session are queued at safety
// priority (they jump anything already waiting), so an operator who skipped or reopened past the
// morning screen still hears them first. "This session" = this guard instance: reopening the app
// creates a new guard, so notes are repeated once, which is the safe side.
//
//   const guard = createBriefingGuard({ queue, lang: 'hi' });   // fetchNotes defaults to GET /memory/{id}
//   await guard.ensureBriefed('EXC001');                         // then continue the normal task flow

export const DEFAULT_API_BASE = 'http://localhost:8000';

export function createBriefingGuard({
  queue,
  lang = 'en',
  apiBase = DEFAULT_API_BASE,
  fetchImpl = globalThis.fetch,
  fetchNotes = async (machineId) => {
    const r = await fetchImpl(`${apiBase}/memory/${encodeURIComponent(machineId)}`);
    return r.ok ? r.json() : [];
  },
} = {}) {
  const heard = new Set();          // note ids already queued this session
  const inflight = new Map();       // machineId -> promise, so two screens loading at once don't double up
  let currentLang = lang;

  async function brief(machineId) {
    let notes = [];
    try {
      notes = (await fetchNotes(machineId)) ?? [];
    } catch {
      return [];                    // offline / API down: never block the task flow
    }
    const fresh = notes.filter((n) => n.machine_id === machineId && !heard.has(n.id));
    for (const n of fresh) {
      heard.add(n.id);
      queue.push({ priority: 'safety', mode: 'alert', message_key: n.message_key, slots: n.slots ?? {}, lang: currentLang });
    }
    return fresh;
  }

  // Queue unheard notes for this machine; resolves to the notes queued (possibly none).
  function ensureBriefed(machineId) {
    if (!inflight.has(machineId)) {
      inflight.set(machineId, brief(machineId).finally(() => inflight.delete(machineId)));
    }
    return inflight.get(machineId);
  }

  return {
    ensureBriefed,
    // For a screen that spoke notes itself: record them so they are not repeated.
    markHeard(notes) { for (const n of notes ?? []) heard.add(n.id); },
    hasHeard(noteId) { return heard.has(noteId); },
    setLang(l) { currentLang = l; },
  };
}
