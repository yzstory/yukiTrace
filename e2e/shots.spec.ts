import { test, expect, type Page } from "@playwright/test";

const TRIP = process.env.SHOT_TRIP!;
const OUT = "/tmp/shots";

async function settle(page: Page) {
  // 等 RSC 流式渲染结束（骨架消失），dev 模式首访会编译路由
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(300);
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill("shot@example.com");
  await page.getByLabel("密码").fill("secret123");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/trips$/);
}
// 全页截图时隐藏固定定位元素（底栏 / 浮钮），否则它们会画在页面中间干扰判断
const HIDE_FIXED = `nav, button[aria-label="快速记录"], button[aria-label="AI 助手"], [data-nextjs-dev-tools-button], nextjs-portal { display: none !important; }`;
const shot = async (page: Page, name: string) => {
  await page.addStyleTag({ content: HIDE_FIXED });
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
};
const vshot = (page: Page, name: string) => page.screenshot({ path: `${OUT}/${name}.png` });

test("截图全站", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto("/login"); await shot(page, "01-login");
  await page.goto("/signup"); await shot(page, "02-signup");
  await login(page);
  await settle(page);
  await vshot(page, "10-trips-viewport");
  await shot(page, "10-trips");
  await page.goto(`/trips/${TRIP}`); await page.waitForTimeout(800); await vshot(page, "11-timeline-viewport"); await shot(page, "11-timeline");
  await page.goto(`/trips/${TRIP}`); await page.waitForTimeout(500);

  // 快速记录抽屉
  await page.getByRole("button", { name: "快速记录" }).click();
  const dlg = page.getByRole("dialog"); await expect(dlg).toBeVisible(); await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/12-quickadd-menu.png` });
  await dlg.getByRole("button", { name: "此刻", exact: true }).click(); await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/13-quickadd-moment.png` });
  await dlg.getByRole("button", { name: "返回" }).click(); await page.waitForTimeout(300);
  await dlg.getByRole("button", { name: "花费", exact: true }).click(); await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/14-quickadd-expense.png` });
  await dlg.getByRole("button", { name: "返回" }).click(); await page.waitForTimeout(300);
  await dlg.getByRole("button", { name: "地点", exact: true }).click(); await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/15-quickadd-stop.png` });
  await dlg.getByRole("button", { name: "返回" }).click(); await page.waitForTimeout(300);
  await dlg.getByRole("button", { name: "航班", exact: true }).click(); await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/16-quickadd-flight.png` });
  await page.keyboard.press("Escape"); await page.waitForTimeout(400);

  // AI 抽屉
  await page.getByRole("button", { name: "AI 助手" }).click(); await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/17-ai-drawer.png` });
  await page.keyboard.press("Escape"); await page.waitForTimeout(400);

  await page.goto(`/trips/${TRIP}/map`); await page.waitForTimeout(1500); await page.screenshot({ path: `${OUT}/20-map.png` });
  await page.goto(`/trips/${TRIP}/ledger`); await page.waitForTimeout(800); await shot(page, "21-ledger");
  await page.goto(`/trips/${TRIP}/photos`); await page.waitForTimeout(500); await shot(page, "22-photos");
  await page.goto(`/trips/${TRIP}/album`); await page.waitForTimeout(500); await shot(page, "23-album");
  await page.goto(`/trips/${TRIP}/summary`); await page.waitForTimeout(1200); await shot(page, "24-summary");
  await page.goto(`/trips/${TRIP}/members`); await settle(page); await shot(page, "25-members");
  await page.goto(`/trips/${TRIP}/checklist`); await shot(page, "26-checklist");
  await page.goto(`/trips/${TRIP}/edit`); await settle(page); await shot(page, "27-edit");
  await page.goto("/trips/new"); await settle(page); await shot(page, "28-new-trip");
  await page.goto("/map"); await page.waitForTimeout(1200); await shot(page, "30-footprints");
  await page.goto("/ledger"); await shot(page, "31-global-ledger");
  await page.goto("/ask"); await shot(page, "32-ask");
  await page.goto("/me"); await settle(page); await shot(page, "33-me");
  await page.goto("/year/2026"); await page.waitForTimeout(800); await shot(page, "34-year");
  await page.goto("/settings/mcp"); await shot(page, "35-mcp");

  // 深色模式几页
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/trips"); await page.waitForTimeout(400); await shot(page, "40-dark-trips");
  await page.goto(`/trips/${TRIP}`); await page.waitForTimeout(600); await shot(page, "41-dark-timeline");
  await page.goto(`/trips/${TRIP}/ledger`); await page.waitForTimeout(600); await shot(page, "42-dark-ledger");
});
