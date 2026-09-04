import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ArticlesCarousel, { SCROLL_STEP, nextScrollLeft, scrollBounds } from "@/components/compass/ArticlesCarousel";
import type { Article } from "@/lib/ghost";

const mk = (i: number, extra: Partial<Article> = {}): Article => ({
  id: `id${i}`, title: `Article ${i}`, url: `https://jobhackers.global/a${i}/`, image: `https://img/${i}.png`,
  readingTime: 3, step: { slug: "focus", label: "1. Focus", color: "#c2001f" }, publishedAt: null, ...extra,
});

// jsdom has no layout: fake a 900px viewport over a 5-card rail (5*268 + 4*16 = 1404).
function layout(el: HTMLElement, scrollWidth = 1404, clientWidth = 900) {
  Object.defineProperty(el, "scrollWidth", { configurable: true, value: scrollWidth });
  Object.defineProperty(el, "clientWidth", { configurable: true, value: clientWidth });
  let left = 0;
  Object.defineProperty(el, "scrollLeft", { configurable: true, get: () => left, set: (v: number) => { left = v; } });
  const scrollTo = vi.fn(({ left: l }: { left: number }) => { el.scrollLeft = l; fireEvent.scroll(el); });
  (el as unknown as { scrollTo: typeof scrollTo }).scrollTo = scrollTo;
  return scrollTo;
}

describe("scroll helpers", () => {
  it("steps by exactly one card + gap (284px) and clamps at both ends", () => {
    expect(SCROLL_STEP).toBe(284);
    expect(nextScrollLeft(0, 1, 504)).toBe(284);
    expect(nextScrollLeft(284, 1, 504)).toBe(504);   // clamped to max
    expect(nextScrollLeft(504, 1, 504)).toBe(504);
    expect(nextScrollLeft(100, -1, 504)).toBe(0);    // clamped to 0
    expect(nextScrollLeft(0, -1, 504)).toBe(0);
  });
  it("reports start/end", () => {
    expect(scrollBounds({ scrollLeft: 0, scrollWidth: 1404, clientWidth: 900 })).toEqual({ atStart: true, atEnd: false, max: 504 });
    expect(scrollBounds({ scrollLeft: 504, scrollWidth: 1404, clientWidth: 900 })).toEqual({ atStart: false, atEnd: true, max: 504 });
    // everything fits -> both arrows off
    expect(scrollBounds({ scrollLeft: 0, scrollWidth: 800, clientWidth: 900 })).toEqual({ atStart: true, atEnd: true, max: 0 });
  });
});

describe("ArticlesCarousel", () => {
  it("renders nothing when there are no articles", () => {
    const { container } = render(<ArticlesCarousel articles={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("arrows scroll the rail by 284px and disable at each end", async () => {
    render(<ArticlesCarousel articles={[1, 2, 3, 4, 5].map((i) => mk(i))} />);
    const track = screen.getByTestId("articles-track");
    const scrollTo = layout(track);
    act(() => { fireEvent.scroll(track); }); // initial measure with the faked layout

    const prev = screen.getByRole("button", { name: "Previous articles" });
    const next = screen.getByRole("button", { name: "Next articles" });
    expect(prev).toBeDisabled();
    expect(next).toBeEnabled();

    act(() => { fireEvent.click(next); });
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 284, behavior: "smooth" });
    expect(prev).toBeEnabled();
    expect(next).toBeEnabled();

    act(() => { fireEvent.click(next); });
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 504, behavior: "smooth" }); // clamped: not 568
    expect(next).toBeDisabled();

    act(() => { fireEvent.click(next); }); // no-op at the end
    expect(track.scrollLeft).toBe(504);

    act(() => { fireEvent.click(prev); });
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 220, behavior: "smooth" });
    act(() => { fireEvent.click(prev); });
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: "smooth" }); // clamped: not -64
    expect(prev).toBeDisabled();
  });

  it("cards are real new-tab links with cover, step, title and reading time", () => {
    render(<ArticlesCarousel articles={[mk(1)]} />);
    const card = screen.getByRole("link", { name: /Article 1/ });
    expect(card).toHaveAttribute("href", "https://jobhackers.global/a1/");
    expect(card).toHaveAttribute("target", "_blank");
    expect(card.getAttribute("rel")).toContain("noopener");
    expect(card.querySelector("img")).toHaveAttribute("src", "https://img/1.png");
    expect(screen.getByText("1. Focus")).toBeInTheDocument();
    expect(screen.getByText("3 min read")).toBeInTheDocument();
  });

  it("hides what's missing: no image -> neutral block, no reading time -> no line, no step -> no dot row", () => {
    render(<ArticlesCarousel articles={[mk(1, { image: null, readingTime: null, step: null })]} />);
    const card = screen.getByTestId("article-card");
    expect(card.querySelector("img")).toBeNull();
    expect(card.querySelector(".bg-jh-mist")).not.toBeNull();
    expect(screen.queryByText(/min read/)).not.toBeInTheDocument();
    expect(screen.queryByText("1. Focus")).not.toBeInTheDocument();
  });

  it("swaps a broken cover for the neutral block", () => {
    render(<ArticlesCarousel articles={[mk(1)]} />);
    const img = screen.getByTestId("article-card").querySelector("img")!;
    fireEvent.error(img);
    expect(screen.getByTestId("article-card").querySelector("img")).toBeNull();
    expect(screen.getByTestId("article-card").querySelector(".bg-jh-mist")).not.toBeNull();
  });
});
