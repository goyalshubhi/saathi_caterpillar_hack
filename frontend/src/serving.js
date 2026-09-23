// Startup check for the app's entry file: opened as file:// (double-clicking index.html), the audio
// manifest and API fetches fail silently. Render SERVE_MESSAGE as a one-line banner instead.
//
//   const problem = servingProblem();          // first thing in the entry file
//   if (problem) { showBanner(problem); }       // one line, instead of a silently broken demo
export const SERVE_MESSAGE = 'Must be served via a dev server (npm run dev), not opened directly.';

export function servingProblem(location = globalThis.location) {
  return location?.protocol === 'file:' ? SERVE_MESSAGE : null;
}
