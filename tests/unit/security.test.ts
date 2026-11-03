import { describe, it, expect, vi, afterEach } from "vitest";
import { validMeetingUrl, providerMatches } from "@/lib/security/meeting-url";
import { sessionSchema, profileSchema } from "@/lib/validations";
import { lifecycle } from "@/lib/data";
import { fallbackDescription, descriptionAssistant } from "@/lib/ai/assistant";
vi.mock("@/lib/backend/server", () => ({ db: vi.fn() }));
afterEach(() => vi.unstubAllEnvs());
describe("meeting URL boundaries", () => {
  it.each([
    "https://meet.google.com/abc-defg-hij",
    "https://us02web.zoom.us/j/123456789?pwd=abc",
    "https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc/0?context=abc",
  ])("accepts approved direct URL %s", (u) =>
    expect(validMeetingUrl(u)).toBe(true),
  );
  it.each([
    "http://meet.google.com/abc-defg-hij",
    "javascript:alert(1)",
    "https://meet.google.com.evil.test/abc-defg-hij",
    "https://meet.google.com@evil.test/abc-defg-hij",
    "https://evil.test/?next=https://meet.google.com/abc-defg-hij",
    "https://zoom.us/redirect?url=https://evil.test",
    "https://meet.google.com/abc-defg-hij?redirect=https://evil.test",
    "https://meet.google.com:444/abc-defg-hij",
    "https://meet.google.com/abc-defg-hij#foo",
    "https://zoom.us/j/123?%72edirect=https://evil.test",
  ])("rejects unsafe URL %s", (u) => expect(validMeetingUrl(u)).toBe(false));
  it("requires platform match", () =>
    expect(
      providerMatches("https://meet.google.com/abc-defg-hij", "Zoom"),
    ).toBe(false));
});
describe("lifecycle and fallback", () => {
  it("does not describe a scheduled window as live", () =>
    expect(
      lifecycle(
        {
          status: "published",
          starts_at: "2030-01-01T10:00:00Z",
          ends_at: "2030-01-01T11:00:00Z",
        },
        Date.parse("2030-01-01T10:30:00Z"),
      ),
    ).toBe("In scheduled time window"));
  it("handles time zone offsets as absolute instants", () =>
    expect(new Date("2030-01-01T15:30:00+05:30").toISOString()).toBe(
      "2030-01-01T10:00:00.000Z",
    ));
  it("keeps drafts distinct from completion", () =>
    expect(
      lifecycle({
        status: "draft",
        starts_at: "2020-01-01",
        ends_at: "2020-01-02",
      }),
    ).toBe("draft"));
  it("works when Ollama is disabled", async () => {
    vi.stubEnv("AI_ENABLED", "false");
    expect(
      (await descriptionAssistant("Learn Python", "Build a script")).text,
    ).toBe(fallbackDescription("Learn Python", "Build a script"));
  });
  it("does not contact non-local model hosts", async () => {
    vi.stubEnv("AI_ENABLED", "true");
    vi.stubEnv("OLLAMA_BASE_URL", "https://external.example");
    expect((await descriptionAssistant("Learn Python", "")).source).toContain(
      "unavailable",
    );
  });
});
describe("server validation", () => {
  it("rejects role injection by stripping unknown profile keys", () => {
    const result = profileSchema.parse({
      display_name: "Student",
      username: "learner",
      bio: "",
      interests: "",
      skills: "",
      learn: "",
      teach: "",
      language: "English",
      time_zone: "UTC",
      college: "",
      course: "",
      year: "",
      academic_public: false,
      role: "admin",
    });
    expect(result).not.toHaveProperty("role");
  });
  it("rejects invalid meeting times", () =>
    expect(sessionSchema.safeParse({}).success).toBe(false));
});
