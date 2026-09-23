// Demo mode at max pace from the Stage View: every demo step's screen appears, no console errors.
import { test, expect } from '@playwright/test';

test('scripted demo runs end to end from /stage', async ({ page }) => {
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

  await page.goto('/stage');
  await page.getByTestId('start-saathi').click();
  await expect(page.getByTestId('sim-badge')).toBeVisible();
  await page.getByTestId('pace-max').click();
  await page.getByTestId('start-demo').click();

  // 1. Morning (Hindi)
  await expect(page.getByTestId('screen-morning')).toBeVisible();
  await expect(page.getByText('सुप्रभात')).toBeVisible();
  // 2. Pre-task
  await expect(page.getByTestId('screen-pretask')).toBeVisible();
  await expect(page.getByTestId('saathi-prediction').locator('[data-value="52"]')).toHaveCount(1);
  // 3. In-task replay: telemetry streams, safety banner fires, no avatar
  await expect(page.getByTestId('screen-intask')).toBeVisible();
  await expect(page.getByTestId('avatar')).toHaveCount(0);
  await expect(page.getByTestId('uth-events')).toContainText('Safety alert');
  // 4. Incident logged and listed
  await expect(page.getByTestId('screen-incidents')).toBeVisible();
  await expect(page.getByTestId('incident-list')).toContainText(/क्षेत्र में व्यक्ति|Person in zone/);
  // 5. Debrief split
  await expect(page.getByTestId('screen-debrief')).toBeVisible();
  await expect(page.getByTestId('seg-uncontrollable')).toHaveAttribute('data-minutes', '6');
  await expect(page.getByTestId('seg-controllable')).toHaveAttribute('data-minutes', '3');
  // 6. Shift 2: Machine Memory warns the next operator
  await expect(page.getByTestId('shift2-overlay')).toBeVisible();
  await expect(page.getByTestId('screen-morning')).toBeVisible();
  await expect(page.getByTestId('memory-card')).toHaveClass(/has-note/);
  // 7. Break
  await expect(page.getByTestId('screen-break')).toBeVisible();
  await expect(page.getByTestId('demo-status')).toHaveText('Demo complete', { timeout: 60000 });

  // The voice queue logged decisions, including the safety lines.
  await expect(page.getByTestId('uth-queue')).toContainText('memory_incident');
  expect(problems).toEqual([]);
});
