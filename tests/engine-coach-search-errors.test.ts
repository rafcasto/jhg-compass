import { describe, it, expect } from "vitest";
import { contextNote, searchErrorNote, searchErrorsOf } from "@/lib/engine/coach/turn";
import { SEARCH_ERROR_WORDS, searchErrorWords } from "@/lib/engine/coach/transcript";
import { findCoach } from "@/lib/engine/coach/keys";

// docs/SEARCH_TO_API_ASSESSMENT_2026-11-17.md §4 PR 0: a web search that answers an error block is
// recorded and said, never improvised around ("while the tool is unavailable…").

const results = (urls: string[]) => ({ type: "web_search_tool_result", tool_use_id: "s1", content: urls.map((url) => ({ type: "web_search_result", url, title: url })) });
const failed = (error_code: string) => ({ type: "web_search_tool_result", tool_use_id: "s2", content: { type: "web_search_tool_result_error", error_code } });

describe("searchErrorsOf", () => {
  it("reads the error code of every search that failed, and nothing from the ones that answered", () => {
    expect(searchErrorsOf([{ type: "text" }, results(["https://a.example/1"])])).toEqual([]);
    expect(searchErrorsOf([results([]), failed("max_uses_exceeded"), { type: "server_tool_use" }, failed("unavailable")])).toEqual(["max_uses_exceeded", "unavailable"]);
  });
  it("names an error without a code 'unknown'", () => {
    expect(searchErrorsOf([{ type: "web_search_tool_result", content: { type: "web_search_tool_result_error" } }])).toEqual(["unknown"]);
  });
});

describe("the operator's line", () => {
  it("says the code in plain words and forbids a researched-looking answer", () => {
    const note = searchErrorNote(["max_uses_exceeded", "max_uses_exceeded"]);
    expect(note).toContain("max_uses_exceeded — this turn's search allowance was used up");
    expect(note.match(/max_uses_exceeded/g)).toHaveLength(1);
    expect(note).toContain("Do not present a list, a number or a link as researched");
  });
  it("rides the next turn's operator note", () => {
    const note = contextNote({ page: "companies", searchErrors: ["unavailable"] });
    expect(note).toContain("The member is looking at Target companies.");
    expect(note).toContain("Your web search failed (unavailable — the search service was unavailable)");
    expect(contextNote({ page: null, searchErrors: [] })).toBeNull();
  });
  it("has a word for every code the API documents", () => {
    for (const c of ["invalid_tool_input", "unavailable", "max_uses_exceeded", "too_many_requests", "query_too_long", "request_too_large"]) expect(SEARCH_ERROR_WORDS[c]).toBeTruthy();
    expect(searchErrorWords("something_new")).toBe("the search failed");
  });
});

describe("the stopgap cap", () => {
  it("gives Target companies no web search in the turn — the 40 are the companies job's, never built by hand", () => {
    expect(findCoach("targetCompanies")?.search).toBe(0);
    expect(findCoach("trueNorth")?.search).toBe(5);
  });
});
