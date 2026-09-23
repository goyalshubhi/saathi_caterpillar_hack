// Browser APIs jsdom lacks. Only applies to tests that opt into jsdom (// @vitest-environment jsdom).
if (typeof window !== 'undefined') {
  const { cleanup } = await import('@testing-library/react');
  const { afterEach } = await import('vitest');
  afterEach(() => cleanup());
  window.matchMedia ??= (query) => ({
    matches: false, media: query, onchange: null,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
  });
  window.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  window.scrollTo ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
}
