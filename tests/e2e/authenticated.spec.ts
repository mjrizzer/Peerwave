import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
const enabled =
  !!process.env.FIREBASE_AUTH_EMULATOR_HOST &&
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === "demo-peerwave";
const password = "PeerWave-Test-Only-2030!";
async function fixture() {
  const app = getApps()[0] || initializeApp({ projectId: "demo-peerwave" });
  const auth = getAuth(app);
  const store = getFirestore(app);
  const users = [];
  for (const name of ["Host", "Attendee"]) {
    const email = `${name.toLowerCase()}-${randomUUID()}@peerwave.test`;
    const user = await auth.createUser({
      email,
      password,
      emailVerified: true,
    });
    await store
      .collection("profiles")
      .doc(user.uid)
      .set({
        id: user.uid,
        display_name: `Test ${name}`,
        username: `${name.toLowerCase()}_${user.uid.slice(0, 8)}`,
        bio: "",
        interests: "Python",
        skills: "",
        learn: "",
        teach: "",
        language: "English",
        time_zone: "UTC",
        onboarded: true,
        suspended: false,
        created_at: new Date().toISOString(),
      });
    users.push({ email, uid: user.uid });
  }
  await store
    .collection("categories")
    .doc("category-e2e-python")
    .set({
      id: "category-e2e-python",
      name: "E2E Python",
      slug: "e2e-python",
      active: true,
    });
  return users;
}
async function login(page: Page, email: string) {
  await page.goto("/auth/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Welcome back" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });
}
test.describe("authenticated Firebase end-to-end", () => {
  test.skip(
    !enabled,
    "Requires local Firebase emulators; never production credentials",
  );
  test("host and attendee register, exchange messages, ask a question, and join securely", async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(120000);
    const [host, attendee] = await fixture();
    await login(page, host.email);
    await page.goto("/host");
    await page
      .getByLabel("Give your session a title")
      .fill(`Python together ${info.project.name}`);
    await page
      .getByLabel("What will you explore together?")
      .fill(
        "Build a practical Python script together and ask questions about every step.",
      );
    await page
      .locator('select[name="category_id"]')
      .selectOption("category-e2e-python");
    await page.getByLabel("Subject", { exact: true }).fill("Python");
    await page
      .getByLabel("Starts · your device’s local time")
      .fill(new Date(Date.now() + 120000).toISOString().slice(0, 16));
    await page
      .getByLabel("Ends · your device’s local time")
      .fill(new Date(Date.now() + 3720000).toISOString().slice(0, 16));
    await page
      .getByLabel("Private meeting URL")
      .fill("https://meet.google.com/abc-defg-hij");
    await page.getByLabel("I created this meeting").check();
    await page.locator('select[name="status"]').selectOption("published");
    await page
      .getByRole("button", { name: "Save session", exact: false })
      .click();
    await expect(page).toHaveURL(/\/sessions\/[a-z0-9-]+$/, { timeout: 30000 });
    const url = page.url();
    const sid = url.split("/").pop();
    const context = await browser.newContext({
      baseURL: "http://localhost:3100",
      timezoneId: "UTC",
    });
    const second = await context.newPage();
    await second.goto(url);
    await expect(
      second.getByRole("link", { name: "Sign in to register" }),
    ).toBeVisible();
    const denied = await second.request.post("/api/commands", {
      headers: { Origin: "http://localhost:3100" },
      data: { action: "join", payload: { id: sid } },
    });
    expect(denied.status()).toBe(401);
    await login(second, attendee.email);
    await second.goto(url);
    await second.getByRole("button", { name: "Register for free" }).click();
    await expect(second.getByText("Your registration: approved")).toBeVisible();
    await second
      .getByLabel("Share a thought or a useful resource")
      .fill("Hello from a fellow learner!");
    await second
      .getByRole("button", { name: "Post message", exact: true })
      .click();
    await expect(
      page.getByText("Hello from a fellow learner!", { exact: true }),
    ).toBeVisible({ timeout: 20000 });
    await second
      .getByLabel("What would you like to understand?")
      .fill("How does a Python list work?");
    await second
      .getByRole("button", { name: "Ask a question", exact: true })
      .click();
    await expect(
      page.getByText("How does a Python list work?", { exact: true }),
    ).toBeVisible({ timeout: 20000 });
    await second.getByRole("button", { name: "Get joining details" }).click();
    await expect(
      second.getByRole("link", { name: "Open meeting" }),
    ).toHaveAttribute("href", "https://meet.google.com/abc-defg-hij");
    await second.goto("/dashboard");
    await second.getByRole("button", { name: "Log out" }).click();
    await expect(second).toHaveURL("http://localhost:3100/");
    await second.goto("/dashboard");
    await expect(second).toHaveURL(/\/auth\/login/);
    await context.close();
  });
  test("new signup verifies email and completes onboarding", async ({
    page,
  }) => {
    test.setTimeout(90000);
    const email = `signup-${randomUUID()}@peerwave.test`;
    await page.goto("/auth/signup");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Create your account" }).click();
    await expect(
      page.getByText("Check your email to verify your account, then sign in."),
    ).toBeVisible();
    const app = getApps()[0] || initializeApp({ projectId: "demo-peerwave" });
    const user = await getAuth(app).getUserByEmail(email);
    await getAuth(app).updateUser(user.uid, { emailVerified: true });
    await page.goto("/auth/login");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Welcome back" }).click();
    await expect(page).toHaveURL(/\/onboarding/);
    await page
      .getByLabel("Display name", { exact: true })
      .fill("A new learner");
    await page
      .getByLabel("Username (lowercase letters, numbers, underscore)")
      .fill("new_" + randomUUID().slice(0, 8));
    await page.getByRole("button", { name: "Save my profile" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
