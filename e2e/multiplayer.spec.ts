import { expect, test, type Page } from '@playwright/test';

const roomName = 'Playwright Arena';
const hostName = 'Host Pilot';
const guestName = 'Guest Pilot';

async function enterMultiplayer(page: Page, playerName: string) {
  await page.addInitScript(() => {
    localStorage.setItem('typing-settings-storage', JSON.stringify({
      state: {
        gameMode: 'English',
        caseMode: 'lowercase',
        timeMode: 15,
        soundEnabled: false,
      },
      version: 0,
    }));
  });
  await page.goto('/');
  await page.getByTestId('nav-multiplayer').click();
  await expect(page.getByTestId('connection-status')).toHaveText('已連線');
  await page.getByTestId('player-name-input').fill(playerName);
  await page.getByTestId('confirm-player-name').click();
}

test('two isolated players can join, ready, start, and receive authoritative scoring', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  try {
    await enterMultiplayer(host, hostName);
    await host.getByTestId('open-create-room').click();
    await host.getByTestId('room-name-input').fill(roomName);
    await host.getByTestId('confirm-create-room').click();
    await expect(host.getByTestId('room-view')).toContainText(roomName);

    await enterMultiplayer(guest, guestName);
    await expect(guest.getByTestId('room-list').getByText(roomName)).toBeVisible();
    await guest.getByTestId('room-list').getByText(roomName).click();

    await expect(host.getByTestId('room-view')).toContainText(guestName);
    await expect(guest.getByTestId('room-view')).toContainText(hostName);

    await host.getByTestId('ready-button').click();
    await guest.getByTestId('ready-button').click();

    await expect(host.getByTestId('multiplayer-game')).toBeVisible();
    await expect(guest.getByTestId('multiplayer-game')).toBeVisible();

    const hostTarget = await host.getByTestId('current-character').textContent();
    const guestTarget = await guest.getByTestId('current-character').textContent();
    expect(hostTarget).toBeTruthy();
    expect(guestTarget).toBe(hostTarget);

    const wrongKey = hostTarget === 'a' ? 'b' : 'a';
    await host.keyboard.press(wrongKey);
    await expect(host.getByTestId('my-errors')).toHaveText('1');
    await expect(host.getByTestId('my-score')).toHaveText('0');

    await host.keyboard.press(hostTarget!);
    await expect(host.getByTestId('my-score')).toHaveText('1');
    await expect(
      guest.locator(`[data-player-name="${hostName}"]`).getByTestId('ranking-score'),
    ).toHaveText('1');
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
