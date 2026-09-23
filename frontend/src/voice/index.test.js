import { describe, it, expect } from 'vitest';
import { VOICE_ENGINE_VERSION } from './index.js';

describe('voice package', () => {
  it('imports', () => expect(VOICE_ENGINE_VERSION).toBe(1));
});
