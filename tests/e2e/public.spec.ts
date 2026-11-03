import { test, expect } from "@playwright/test";
test("homepage, discovery and setup states are accessible", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Your next learning moment starts with someone like you.",
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Explore sessions", exact: true })
    .filter({ visible: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "Find your next aha moment." }),
  ).toBeVisible();
  await page
    .getByPlaceholder("Try Python, interviews, public speaking…")
    .fill("Python");
  await page.getByRole("button", { name: "Find sessions" }).click();
  await expect(page).toHaveURL(/q=Python/);
});
test("public pages do not overflow mobile or desktop", async ({ page }) => {
  for (const path of [
    "/",
    "/sessions",
    "/requests",
    "/circles",
    "/doubts",
    "/people",
    "/auth/signup",
    "/guidelines",
    "/privacy",
  ]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow, `${path} must fit viewport`).toBe(false);
  }
});
test("protected pages direct visitors to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/auth\/login/);
  await page.goto("/moderation");
  await expect(page).toHaveURL(/\/auth\/login/);
});
test("theme toggle persists and navigation is keyboard reachable", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  if (isMobile) await page.getByLabel("Open navigation").click();
  await page.getByRole("button", { name: "Use dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
});
test("cross-origin mutations fail closed", async ({ request }) => {
  const response = await request.post("/api/commands", {
    headers: { Origin: "https://untrusted.example" },
    data: {
      action: "join",
      payload: { id: "10000000-0000-4000-8000-000000000001" },
    },
  });
  expect(response.status()).toBe(403);
});
