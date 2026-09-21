import { test, expect, type Response } from '@playwright/test';

test.describe('Game Listing and Navigation', () => {
  /** Verifies multi-category filtering uses OR semantics. */
  test('should filter games by one or more categories', async ({ page }) => {
    await page.goto('/');

    const strategyFilter = page.getByRole('checkbox', { name: 'Strategy' });
    const puzzleFilter = page.getByRole('checkbox', { name: 'Puzzle' });
    const visibleGameCards = page.locator('[data-testid="game-card"]:not([hidden])');

    await test.step('Filter by one category', async () => {
      await strategyFilter.check();

      await expect(visibleGameCards).toHaveCount(4);
      await expect(page.getByTestId('filter-results-status')).toHaveText('4 games shown');
      await expect.poll(() => page.evaluate(() => new URLSearchParams(location.search).getAll('category').length)).toBe(1);
    });

    await test.step('Add another category with OR matching', async () => {
      await puzzleFilter.check();

      await expect(visibleGameCards).toHaveCount(8);
      await expect(page.getByTestId('filter-results-status')).toHaveText('8 games shown');
      await expect.poll(() => page.evaluate(() => new URLSearchParams(location.search).getAll('category').length)).toBe(2);
    });
  });

  /** Verifies selecting a publisher limits the visible catalog. */
  test('should filter games by publisher', async ({ page }) => {
    await page.goto('/');

    await page.getByLabel('Publisher').selectOption({ label: 'CodeForge Studios' });

    await expect(page.locator('[data-testid="game-card"]:not([hidden])')).toHaveCount(6);
    await expect(page.getByTestId('filter-results-status')).toHaveText('6 games shown');
    await expect.poll(() => page.evaluate(() => new URLSearchParams(location.search).has('publisher'))).toBe(true);
  });

  /** Verifies category and publisher criteria combine with AND semantics. */
  test('should combine category and publisher filters', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('checkbox', { name: 'Strategy' }).check();
    await page.getByLabel('Publisher').selectOption({ label: 'DevMasters Inc.' });

    const visibleGameCards = page.locator('[data-testid="game-card"]:not([hidden])');
    await expect(visibleGameCards).toHaveCount(1);
    await expect(visibleGameCards.getByTestId('game-category')).toHaveText('Strategy');
    await expect(visibleGameCards.getByTestId('game-publisher')).toHaveText('DevMasters Inc.');
    await expect(page.getByTestId('filter-results-status')).toHaveText('1 game shown');
  });

  /** Verifies bookmarkable filter state is restored after navigation. */
  test('should restore filters from the URL after reload', async ({ page }) => {
    await page.goto('/');

    const strategyFilter = page.getByRole('checkbox', { name: 'Strategy' });
    const publisherFilter = page.getByLabel('Publisher');
    await strategyFilter.check();
    await publisherFilter.selectOption({ label: 'GitHub Games' });

    const selectedPublisherId = await publisherFilter.inputValue();
    const filteredUrl = page.url();
    await page.reload();

    await expect(page).toHaveURL(filteredUrl);
    await expect(strategyFilter).toBeChecked();
    await expect(publisherFilter).toHaveValue(selectedPublisherId);
    await expect(page.locator('[data-testid="game-card"]:not([hidden])')).toHaveCount(1);
  });

  /** Verifies clearing filters restores the complete catalog and clean URL. */
  test('should clear selected filters and restore the full catalog', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('checkbox', { name: 'Action' }).check();
    await page.getByLabel('Publisher').selectOption({ label: 'CodeForge Studios' });
    const clearFilters = page.getByTestId('clear-game-filters');

    await expect(clearFilters).toBeEnabled();
    await clearFilters.click();

    await expect(page.getByRole('checkbox', { name: 'Action' })).not.toBeChecked();
    await expect(page.getByLabel('Publisher')).toHaveValue('');
    await expect(page.locator('[data-testid="game-card"]:not([hidden])')).toHaveCount(21);
    await expect(page.getByTestId('filter-results-status')).toHaveText('21 games shown');
    await expect(page).toHaveURL('/');
    await expect(clearFilters).toBeDisabled();
  });

  /** Verifies the empty state and live status when no cards match. */
  test('should show an empty state when no games match', async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('game-card').evaluateAll((cards) => {
      for (const card of cards) {
        card.setAttribute('data-publisher-id', 'no-match');
      }
    });
    await page.getByLabel('Publisher').selectOption({ label: 'Ops Interactive' });

    await expect(page.getByTestId('games-grid')).toBeHidden();
    await expect(page.getByTestId('filtered-games-empty')).toBeVisible();
    await expect(page.getByTestId('filter-results-status')).toHaveText('0 games shown');
  });

  /** Verifies native filter controls remain keyboard operable. */
  test('should operate filter controls with the keyboard', async ({ page }) => {
    await page.goto('/');

    const strategyFilter = page.getByRole('checkbox', { name: 'Strategy' });
    await strategyFilter.focus();
    await expect(strategyFilter).toBeFocused();
    await page.keyboard.press('Space');
    await expect(strategyFilter).toBeChecked();

    const publisherFilter = page.getByLabel('Publisher');
    await publisherFilter.focus();
    await expect(publisherFilter).toBeFocused();
    await publisherFilter.selectOption({ label: 'GitHub Games' });
    await expect(page.getByTestId('filter-results-status')).toHaveText('1 game shown');
  });

  test('should display games with titles on index page', async ({ page }) => {
    await test.step('Navigate to homepage', async () => {
      await page.goto('/');
    });

    await test.step('Verify games grid is visible', async () => {
      const gamesGrid = page.getByTestId('games-grid');
      await expect(gamesGrid).toBeVisible();
    });

    await test.step('Verify game cards are displayed', async () => {
      const gameCards = page.getByTestId('game-card');
      await expect(gameCards.first()).toBeVisible();
      expect(await gameCards.count()).toBeGreaterThan(0);
    });

    await test.step('Verify game cards have titles with content', async () => {
      const gameCards = page.getByTestId('game-card');
      await expect(gameCards.first().getByTestId('game-title')).toBeVisible();
      await expect(gameCards.first().getByTestId('game-title')).not.toBeEmpty();
    });
  });

  test('should display each game rating out of five on the index page', async ({ page }) => {
    await page.goto('/');

    const firstGameCard = page.getByTestId('game-card').first();
    const rating = firstGameCard.getByTestId('game-rating');

    await expect(rating).toBeVisible();
    await expect(rating).toHaveText(/\d\.\d \/ 5/);
  });

  test('should navigate to correct game details page when clicking on a game', async ({ page }) => {
    let gameId: string | null;
    let gameTitle: string | null;

    await test.step('Navigate to homepage and wait for games to load', async () => {
      await page.goto('/');
      const gamesGrid = page.getByTestId('games-grid');
      await expect(gamesGrid).toBeVisible();
    });

    await test.step('Get first game information and click it', async () => {
      const firstGameCard = page.getByTestId('game-card').first();
      gameId = await firstGameCard.getAttribute('data-game-id');
      gameTitle = await firstGameCard.getAttribute('data-game-title');
      await firstGameCard.click();
    });

    await test.step('Verify navigation to game details page', async () => {
      await expect(page).toHaveURL(`/game/${gameId}`);
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Verify game title matches clicked game', async () => {
      if (gameTitle) {
        await expect(page.getByTestId('game-details-title')).toHaveText(gameTitle);
      }
    });
  });

  test('should display game details with all required information', async ({ page }) => {
    await test.step('Navigate to specific game details page', async () => {
      await page.goto('/game/1');
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Verify game title is displayed', async () => {
      const gameTitle = page.getByTestId('game-details-title');
      await expect(gameTitle).toBeVisible();
      await expect(gameTitle).not.toBeEmpty();
    });

    await test.step('Verify game description is displayed', async () => {
      const gameDescription = page.getByTestId('game-details-description');
      await expect(gameDescription).toBeVisible();
      await expect(gameDescription).not.toBeEmpty();
    });

    await test.step('Verify publisher or category information is present', async () => {
      const publisherExists = await page.getByTestId('game-details-publisher').isVisible();
      const categoryExists = await page.getByTestId('game-details-category').isVisible();
      expect(publisherExists || categoryExists).toBeTruthy();

      if (publisherExists) {
        await expect(page.getByTestId('game-details-publisher')).not.toBeEmpty();
      }

      if (categoryExists) {
        await expect(page.getByTestId('game-details-category')).not.toBeEmpty();
      }
    });
  });

  test('should display a button to back the game', async ({ page }) => {
    await test.step('Navigate to game details page', async () => {
      await page.goto('/game/1');
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Verify back game button is visible and enabled', async () => {
      const backButton = page.getByTestId('back-game-button');
      await expect(backButton).toBeVisible();
      await expect(backButton).toContainText('Support This Game');
      await expect(backButton).toBeEnabled();
    });
  });

  test('should be able to navigate back to home from game details', async ({ page }) => {
    await test.step('Navigate to game details page', async () => {
      await page.goto('/game/1');
      await expect(page.getByTestId('game-details')).toBeVisible();
    });

    await test.step('Click back to all games link', async () => {
      const backLink = page.getByRole('link', { name: /back to all games/i });
      await expect(backLink).toBeVisible();
      await backLink.click();
    });

    await test.step('Verify navigation back to homepage', async () => {
      await expect(page).toHaveURL('/');
      await expect(page.getByTestId('games-grid')).toBeVisible();
    });
  });

  test('should return a 404 page for a non-existent game', async ({ page }) => {
    let response: Response | null;

    await test.step('Navigate to non-existent game', async () => {
      response = await page.goto('/game/99999');
    });

    await test.step('Verify a branded 404 page is served', async () => {
      expect(response?.status()).toBe(404);
      await expect(page).toHaveTitle(/Page Not Found - Tailspin Toys/);
      await expect(page.getByTestId('not-found')).toBeVisible();
      await expect(page.getByTestId('not-found-heading')).not.toBeEmpty();
      await expect(page.getByTestId('not-found-home-link')).toBeVisible();
    });
  });
});
