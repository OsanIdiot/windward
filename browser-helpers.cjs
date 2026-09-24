async function closeService(page) {
  if (await page.locator('#service-dialog').isVisible()) await page.locator('#close-service').click();
}
async function openService(page, name) {
  if (await page.locator('#service-dialog').isVisible()) await page.locator('#tab-' + name).click();
  else await page.locator('[data-service="' + name + '"]').click();
}
async function openChart(page) {
  if (await page.locator('#voyage-screen').isVisible()) await page.locator('#open-chart-button').click();
}
module.exports = { closeService, openService, openChart };
