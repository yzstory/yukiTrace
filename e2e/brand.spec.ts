import { test, expect } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  test(`手写 Logo：${theme} 登录页与应用图标`, async ({ page, request }, testInfo) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/login");
    const logo = page.getByRole("img", { name: "Trace", exact: true });
    await expect(logo).toBeVisible();
    await expect.poll(() => logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(logo).toHaveAttribute("src", /trace-handwritten-v1/);
    await expect.poll(() => logo.locator("../..").evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    const box = await logo.boundingBox();
    expect(box!.width).toBeGreaterThan(200);
    expect(box!.width / box!.height).toBeCloseTo(1098 / 472, 1);
    for (const url of ["/icons/icon-180.png", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png", "/favicon.ico"]) {
      expect((await request.get(url)).status()).toBe(200);
    }
    await page.screenshot({ path: testInfo.outputPath(`brand-${theme}.png`), fullPage: true });
  });
}
