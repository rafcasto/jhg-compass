import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CoachingScreenTab from "@/components/admin/CoachingScreenTab";
import { COACHING_LIMITS, DEFAULT_COACHING_SCREEN, type CoachingScreenDoc } from "@/lib/coaching-screen";

vi.mock("@/lib/firebase/client", () => ({
  auth: { currentUser: { getIdToken: async () => "tok" } },
}));

const fetchMock = vi.fn();
const emptyDoc: CoachingScreenDoc = { draft: null, published: null, publishedAt: null, publishedBy: null, updatedAt: null, updatedBy: null };

function mockApi(initial: CoachingScreenDoc = emptyDoc) {
  let doc = structuredClone(initial);
  fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      const now = 1_760_000_000_000;
      doc = { ...doc, draft: body.content, updatedAt: now, updatedBy: "admin@jobhackers.global" };
      if (body.action === "publish") doc = { ...doc, published: body.content, publishedAt: now, publishedBy: "admin@jobhackers.global" };
      return { ok: true, json: async () => ({ ok: true, doc, errors: [], warnings: [] }) };
    }
    return { ok: true, json: async () => ({ ok: true, doc }) };
  });
}
const posts = () => fetchMock.mock.calls.filter(([, init]) => (init as RequestInit)?.method === "POST");

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("confirm", vi.fn(() => true));
  mockApi();
});
afterEach(() => {
  delete (HTMLElement.prototype as any).scrollHeight;
  delete (HTMLElement.prototype as any).clientHeight;
});

async function loaded() {
  await waitFor(() => expect(screen.getByLabelText("Line 1")).toHaveValue("Maximize"));
}

describe("Admin → Coaching tab", () => {
  it("starts from the seed copy when nothing is stored, with a live preview and counters", async () => {
    render(<CoachingScreenTab />);
    await loaded();
    expect(screen.getByLabelText("Line 2")).toHaveValue("your job search with the power of a");
    expect(screen.getByLabelText("Benefit 1 title")).toHaveValue("Held accountable");
    expect(screen.getByLabelText("Entitlement 1 body")).toHaveValue(DEFAULT_COACHING_SCREEN.entitlements[0].body);
    expect(screen.getByLabelText("Button URL")).toHaveValue("https://jobhackers.global");
    expect(screen.getByText(`35/${COACHING_LIMITS.headlineLine2}`)).toBeInTheDocument();

    // the preview is the real screen inside the real chrome
    const preview = screen.getByRole("img", { name: "Live preview at 390×844" });
    expect(within(preview).getByRole("heading", { level: 1 })).toHaveTextContent("Coach!");
    expect(within(preview).getByRole("link", { name: "Book a coaching call" })).toBeInTheDocument();
    expect(screen.getByTestId("coaching-audit")).toHaveTextContent("Not published yet");
  });

  it("prefers the draft over the published copy and mirrors typing into the preview", async () => {
    const user = userEvent.setup();
    mockApi({
      ...emptyDoc,
      published: DEFAULT_COACHING_SCREEN,
      draft: { ...DEFAULT_COACHING_SCREEN, headline: { ...DEFAULT_COACHING_SCREEN.headline, line1: "Level up" } },
    });
    render(<CoachingScreenTab />);
    await waitFor(() => expect(screen.getByLabelText("Line 1")).toHaveValue("Level up"));

    await user.clear(screen.getByLabelText("Line 3 (red)"));
    await user.type(screen.getByLabelText("Line 3 (red)"), "Mentor!");
    const preview = screen.getByRole("img", { name: "Live preview at 390×844" });
    expect(within(preview).getByRole("heading", { level: 1 })).toHaveTextContent("Level up");
    expect(within(preview).getByRole("heading", { level: 1 })).toHaveTextContent("Mentor!");
  });

  it("warns past a soft limit without blocking publish", async () => {
    const user = userEvent.setup();
    render(<CoachingScreenTab />);
    await loaded();
    const line1 = screen.getByLabelText("Line 1");
    await user.clear(line1);
    await user.type(line1, "Supercharge it");           // 14 > 12
    expect(screen.getByText(`14/${COACHING_LIMITS.headlineLine1} · over the soft limit`)).toBeInTheDocument();
    expect(screen.getByText(/1 field over the soft limit/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeEnabled();
  });

  it("enforces 2–4 benefits and 1–6 entitlements in the UI", async () => {
    const user = userEvent.setup();
    render(<CoachingScreenTab />);
    await loaded();

    const addBenefit = screen.getByRole("button", { name: "Add benefit" });
    await user.click(addBenefit);                       // 4
    expect(screen.getByLabelText("Benefit 4 title")).toBeInTheDocument();
    expect(addBenefit).toBeDisabled();
    expect(screen.getByText("4 of 2–4")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove benefit 4" }));
    await user.click(screen.getByRole("button", { name: "Remove benefit 3" }));   // 2
    expect(screen.queryByLabelText("Benefit 3 title")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove benefit 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove benefit 2" })).toBeDisabled();

    expect(screen.getByRole("button", { name: "Remove entitlement 1" })).toBeDisabled();
    const addEnt = screen.getByRole("button", { name: "Add entitlement" });
    for (let i = 0; i < 5; i++) await user.click(addEnt);                        // 6
    expect(screen.getByLabelText("Entitlement 6 title")).toBeInTheDocument();
    expect(addEnt).toBeDisabled();
    expect(screen.getByText("6 of 1–6")).toBeInTheDocument();
  });

  it("reorders benefits with the move buttons and via drag-and-drop", async () => {
    const user = userEvent.setup();
    render(<CoachingScreenTab />);
    await loaded();

    await user.click(screen.getByRole("button", { name: "Move benefit 3 up" }));
    expect(screen.getByLabelText("Benefit 2 title")).toHaveValue("Go faster");
    expect(screen.getByLabelText("Benefit 3 title")).toHaveValue("Better odds");
    expect(screen.getByRole("button", { name: "Move benefit 1 up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move benefit 3 down" })).toBeDisabled();

    // drag row 1 onto row 3
    const rows = within(screen.getByRole("list", { name: "Benefits" })).getAllByRole("listitem");
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.dragStart(screen.getByRole("button", { name: "Drag to reorder benefit 1" }), { dataTransfer: { effectAllowed: "" } });
    fireEvent.dragOver(rows[2]);
    fireEvent.drop(rows[2]);
    expect(screen.getByLabelText("Benefit 1 title")).toHaveValue("Go faster");
    expect(screen.getByLabelText("Benefit 2 title")).toHaveValue("Better odds");
    expect(screen.getByLabelText("Benefit 3 title")).toHaveValue("Held accountable");

    // the preview follows the new order
    const preview = screen.getByRole("img", { name: "Live preview at 390×844" });
    const titles = within(preview).getAllByText(/Go faster|Better odds|Held accountable/).map((el) => el.textContent);
    expect(titles).toEqual(["Go faster", "Better odds", "Held accountable"]);
  });

  it("picks emoji only from the brand set", async () => {
    const user = userEvent.setup();
    render(<CoachingScreenTab />);
    await loaded();
    await user.click(screen.getByRole("button", { name: "Benefit 1 emoji: 🤝" }));
    const options = within(screen.getByRole("listbox", { name: "Benefit 1 emoji options" })).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["🎯", "💎", "💼", "✅", "🤝", "💬", "🤑", "🧭", "❤", "🔥", "🤩", "💡", "⚡", "💪", "⏳", "🕒", "🏆", "🗣️"]);
    expect(options.some((o) => o.textContent === "🚀")).toBe(false);
    await user.click(within(screen.getByRole("listbox")).getByRole("option", { name: "🔥" }));
    expect(screen.getByRole("button", { name: "Benefit 1 emoji: 🔥" })).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    const preview = screen.getByRole("img", { name: "Live preview at 390×844" });
    expect(within(preview).getByRole("list", { name: "What you get" })).toHaveTextContent("🔥Held accountable");
  });

  it("blocks publish on an invalid CTA url or a blank required field, but still saves a draft", async () => {
    const user = userEvent.setup();
    render(<CoachingScreenTab />);
    await loaded();

    const url = screen.getByLabelText("Button URL");
    await user.clear(url);
    await user.type(url, "http://jobhackers.global");
    expect(screen.getByText("CTA URL must be an absolute https:// link.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();

    await user.clear(screen.getByLabelText("Subhead"));
    expect(screen.getByText("Subhead is required.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(screen.getByText("Draft saved.")).toBeInTheDocument());
    expect(posts()).toHaveLength(1);
    const body = JSON.parse(String((posts()[0][1] as RequestInit).body));
    expect(body.action).toBe("draft");
    expect(body.content.cta.url).toBe("http://jobhackers.global");
    expect(screen.getByTestId("coaching-audit")).toHaveTextContent("Not published yet");
    expect(screen.getByTestId("coaching-audit")).toHaveTextContent("Draft saved by admin@jobhackers.global");
  });

  it("publishes the full content model and shows who published and when", async () => {
    const user = userEvent.setup();
    render(<CoachingScreenTab />);
    await loaded();

    await user.clear(screen.getByLabelText("Caption under the button"));
    await user.type(screen.getByLabelText("Caption under the button"), "Free 20 minutes.");
    await user.click(screen.getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(screen.getByText("Published — live for members now.")).toBeInTheDocument());

    const body = JSON.parse(String((posts()[0][1] as RequestInit).body));
    expect(body.action).toBe("publish");
    expect(Object.keys(body.content).sort()).toEqual(["benefits", "cta", "ctaCaption", "entitlements", "headline", "subhead"]);
    expect(body.content.ctaCaption).toBe("Free 20 minutes.");
    expect(body.content.benefits).toHaveLength(3);
    expect(body.content.benefits[0]).toEqual({ emoji: "🤝", title: "Held accountable", body: "A weekly call where you report on what you actually did." });

    const audit = screen.getByTestId("coaching-audit");
    expect(audit).toHaveTextContent("Published by admin@jobhackers.global on");
    expect(audit).toHaveTextContent("2025");
  });

  it("surfaces server-side publish rejections", async () => {
    const user = userEvent.setup();
    render(<CoachingScreenTab />);
    await loaded();
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") return { ok: false, json: async () => ({ ok: false, errors: [{ path: "cta.url", message: "CTA URL must be an absolute https:// link." }] }) };
      return { ok: true, json: async () => ({ ok: true, doc: emptyDoc }) };
    });
    await user.click(screen.getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(screen.getByText("CTA URL must be an absolute https:// link.", { selector: "span" })).toBeInTheDocument());
  });

  it("flags copy that won't fit on a 390×844 screen from the real preview measurement", async () => {
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get() { return this.classList?.contains("coaching-screen") ? 686 : 0; } });
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get() { return this.classList?.contains("coaching-screen") ? 900 : 0; } });
    render(<CoachingScreenTab />);
    await loaded();
    expect(screen.getByRole("status", { name: "" })).toBeTruthy();
    expect(screen.getByText("Won't fit on a 390×844 screen")).toBeInTheDocument();
    expect(screen.queryByText("Fits without scrolling")).not.toBeInTheDocument();
  });
});
