import { expect, test } from '@playwright/test';

/**
 * Browser-level proof of the workspace loop:
 * admin onboards a customer and raises a change order, then that customer signs
 * in, sees a read-only project and rejects the order with a reason.
 */
test.describe('project workspace', () => {
  test('admin onboards a customer who can review and reject a change order', async ({ page }) => {
    const stamp = Date.now();
    const customerEmail = `browser-${stamp}@example.com`;
    const customerPassword = 'BrowserPass123!';
    const projectName = `Browser Build ${stamp}`;

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in to your workspace' })).toBeVisible();
    await page.getByLabel('Work email').fill('admin@alphabuilders.com');
    await page.getByLabel('Password').fill('ChangeMe!123');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();

    await page.goto('/dashboard/projects/new');
    await page.getByLabel('Project name').fill(projectName);
    await page.getByLabel('Contract budget (USD)').fill('420000');
    await page.getByLabel('First name').fill('Browser');
    await page.getByLabel('Last name').fill('Customer');
    await page.getByLabel('Customer email').fill(customerEmail);
    await page.getByLabel('Temporary password').fill(customerPassword);
    await page.getByRole('button', { name: 'Create project' }).click();

    await expect(page).toHaveURL(/\/dashboard\/projects\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { name: projectName })).toBeVisible();
    await expect(page.getByText('Browser Customer')).toBeVisible();

    await page.getByRole('button', { name: 'Raise change order' }).click();
    await page.getByLabel('Title').fill('Upgraded courtyard pavers');
    await page.getByLabel('Scope description').fill('Premium pavers for the rear courtyard.');
    await page.getByLabel('Cost impact (USD)').fill('18500');
    await page.getByRole('button', { name: 'Send for approval' }).click();
    await expect(page.getByRole('link', { name: 'Upgraded courtyard pavers' })).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.getByLabel('Work email').fill(customerEmail);
    await page.getByLabel('Password').fill(customerPassword);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Your projects' })).toBeVisible();
    await page.getByRole('link', { name: projectName, exact: true }).click();

    await expect(page.getByRole('heading', { name: projectName })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Raise change order' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Edit project' })).toHaveCount(0);
    await expect(page.getByText('Decision required')).toBeVisible();

    await page.getByRole('link', { name: /Upgraded courtyard pavers/ }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/change-orders\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('button', { name: 'Approve & sign' })).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept('Over budget for this quarter.'));
    await page.getByRole('button', { name: 'Reject' }).click();

    await expect(page.getByText('rejected', { exact: true })).toBeVisible();
    await expect(page.getByText('Over budget for this quarter.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve & sign' })).toHaveCount(0);
  });

  test('protected pages redirect anonymous visitors to sign in', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
