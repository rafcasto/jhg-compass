import { describe, it, expect, beforeEach } from "vitest";
import { openCoach, resetCoachUi, restoreWide, setWide } from "@/components/coach/store";
import { act, renderHook } from "@testing-library/react";
import { useCoachUi } from "@/components/coach/store";

// The expanded panel is a preference (docs/UX_COACH_AGENTIC.md §11): kept on the device, restored when the panel mounts,
// untouched by closing the panel.

beforeEach(() => resetCoachUi());

describe("the wide preference", () => {
  it("starts docked, expands, and is remembered across a close and a fresh mount", () => {
    const { result } = renderHook(() => useCoachUi());
    expect(result.current.wide).toBe(false);
    act(() => { setWide(true); });
    expect(result.current.wide).toBe(true);
    expect(localStorage.getItem("jh.coach.wide")).toBe("1");
    act(() => { openCoach("narrative"); });
    expect(result.current.wide).toBe(true);
    // A new session on the device: the store starts docked and restores the choice on mount.
    act(() => { resetCoachUi(); localStorage.setItem("jh.coach.wide", "1"); });
    expect(result.current.wide).toBe(false);
    act(() => { restoreWide(); });
    expect(result.current.wide).toBe(true);
    act(() => { setWide(false); });
    expect(localStorage.getItem("jh.coach.wide")).toBe("0");
    act(() => { restoreWide(); });
    expect(result.current.wide).toBe(false);
  });
});
