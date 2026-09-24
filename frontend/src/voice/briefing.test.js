import { describe, it, expect } from 'vitest';
import { createBriefingGuard } from './briefing.js';
import { createQueue } from './queue.js';
import { unlockAudio } from './unlock.js';

unlockAudio(); // these tests start after the Start button's click (see unlock.test.js for before it)

// Speaker that never finishes on its own, so we can see what is playing and what is waiting.
function heldSpeaker() {
  const calls = [];
  return {
    calls,
    speak(event) { calls.push(event.message_key); return { text: event.message_key, lang: event.lang }; },
    cancel() {},
  };
}

const NOTE = { id: 7, machine_id: 'EXC001', created_at: '2026-09-23T08:00:00', expires_at: '2026-09-25T08:00:00',
  message_key: 'memory_incident', slots: { category: 'person_in_zone' } };

const notesFor = (byMachine) => async (machineId) => byMachine[machineId] ?? [];

describe('briefing guard', () => {
  it('surfaces an unheard note on the pre-task screen when the morning screen was skipped', async () => {
    const speaker = heldSpeaker();
    const queue = createQueue({ speaker });
    const guard = createBriefingGuard({ queue, lang: 'hi', fetchNotes: notesFor({ EXC001: [NOTE] }) });

    // operator lands straight on pre-task: guard runs first, then the screen's own lines
    await guard.ensureBriefed('EXC001');
    queue.push({ priority: 'info', mode: 'friendly', message_key: 'pretask_estimate', slots: {}, lang: 'hi' });

    expect(speaker.calls[0]).toBe('memory_incident');
    expect(queue.spoken[0].event).toEqual({ priority: 'safety', mode: 'alert', message_key: 'memory_incident',
      slots: { category: 'person_in_zone' }, lang: 'hi', variant: 0 });   // safety: the one fixed phrasing
    expect(queue.pending.map((e) => e.message_key)).toEqual(['pretask_estimate']);
  });

  it('jumps lines already waiting and interrupts a lesson', async () => {
    const speaker = heldSpeaker();
    const queue = createQueue({ speaker });
    queue.push({ priority: 'coaching', mode: 'friendly', message_key: 'lesson_walkaround', slots: {}, lang: 'en' });
    queue.push({ priority: 'info', mode: 'friendly', message_key: 'task_card', slots: {}, lang: 'en' });
    const guard = createBriefingGuard({ queue, fetchNotes: notesFor({ EXC001: [NOTE] }) });
    await guard.ensureBriefed('EXC001');
    expect(queue.current.message_key).toBe('memory_incident');
    expect(queue.pending.map((e) => e.message_key)).toEqual(['task_card']);
  });

  it('speaks each note once per session across screens', async () => {
    const queue = createQueue({ speaker: heldSpeaker() });
    const guard = createBriefingGuard({ queue, fetchNotes: notesFor({ EXC001: [NOTE] }) });
    expect(await guard.ensureBriefed('EXC001')).toHaveLength(1);    // pre-task
    expect(await guard.ensureBriefed('EXC001')).toEqual([]);        // in-task
    const both = await Promise.all([guard.ensureBriefed('EXC001'), guard.ensureBriefed('EXC001')]);
    expect(both).toEqual([[], []]);
    expect(queue.spoken.length + queue.pending.length).toBe(1);
  });

  it('does not repeat notes the morning screen already spoke, but catches new ones', async () => {
    const newer = { ...NOTE, id: 8, slots: { category: 'machine_issue' } };
    const queue = createQueue({ speaker: heldSpeaker() });
    const guard = createBriefingGuard({ queue, fetchNotes: notesFor({ EXC001: [NOTE, newer] }) });
    guard.markHeard([NOTE]);                                        // morning screen spoke note 7
    const queued = await guard.ensureBriefed('EXC001');
    expect(queued.map((n) => n.id)).toEqual([8]);
    expect(guard.hasHeard(7) && guard.hasHeard(8)).toBe(true);
  });

  it('a new session (app reopened) surfaces the note again', async () => {
    const fetchNotes = notesFor({ EXC001: [NOTE] });
    const first = createBriefingGuard({ queue: createQueue({ speaker: heldSpeaker() }), fetchNotes });
    await first.ensureBriefed('EXC001');
    const reopened = createBriefingGuard({ queue: createQueue({ speaker: heldSpeaker() }), fetchNotes });
    expect(await reopened.ensureBriefed('EXC001')).toHaveLength(1);
  });

  it('only this machine, and never blocks when the API is down', async () => {
    const queue = createQueue({ speaker: heldSpeaker() });
    const guard = createBriefingGuard({ queue, fetchNotes: notesFor({ EXC001: [NOTE] }) });
    expect(await guard.ensureBriefed('EXC002')).toEqual([]);
    const down = createBriefingGuard({ queue, fetchNotes: async () => { throw new Error('offline'); } });
    expect(await down.ensureBriefed('EXC001')).toEqual([]);
    expect(queue.spoken).toEqual([]);
  });

  it('fetches GET /memory/{machine_id} by default', async () => {
    const urls = [];
    const fetchImpl = async (url) => { urls.push(url); return { ok: true, json: async () => [NOTE] }; };
    const guard = createBriefingGuard({ queue: createQueue({ speaker: heldSpeaker() }), fetchImpl });
    expect(await guard.ensureBriefed('EXC001')).toHaveLength(1);
    expect(urls).toEqual(['http://localhost:8000/memory/EXC001']);
  });
});
