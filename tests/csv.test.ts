import { describe, it, expect } from "vitest";
import { parseCsv, parseCsvRows, toCsv, detectDelimiter } from "@/lib/csv";

describe("parseCsv", () => {
  it("parses simple rows and drops blank lines", () => {
    expect(parseCsv("a,b,c\n1,2,3\n\n4,5,6\n")).toEqual([["a", "b", "c"], ["1", "2", "3"], ["4", "5", "6"]]);
  });
  it("handles quotes, escaped quotes and embedded newlines / commas", () => {
    const text = 'name,notes\r\n"Doe, Jane","She said ""hi""\nthen left"\r\n';
    expect(parseCsv(text)).toEqual([["name", "notes"], ["Doe, Jane", 'She said "hi"\nthen left']]);
  });
  it("strips a UTF-8 BOM and accepts bare-CR line endings", () => {
    expect(parseCsv("﻿a,b\r1,2\r")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("sniffs semicolon and tab delimiters from the header line", () => {
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(detectDelimiter("a\tb\n1\t2")).toBe("\t");
    expect(detectDelimiter('"x,y";z')).toBe(";");
    expect(detectDelimiter("just one column")).toBe(",");
    expect(parseCsv("a;b\n1;2")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("keeps a last row without a trailing newline, including empty trailing cells", () => {
    expect(parseCsv("a,b,c\n1,,")).toEqual([["a", "b", "c"], ["1", "", ""]]);
  });
  it("reports the physical line each row starts on, across blank lines and multi-line cells", () => {
    const rows = parseCsvRows('a,b\n\n"multi\r\nline",x\n\ny,z');
    expect(rows.map((r) => [r.line, r.cells])).toEqual([[1, ["a", "b"]], [3, ["multi\nline", "x"]], [6, ["y", "z"]]]);
  });
  it("round-trips through toCsv", () => {
    const rows = [["a", "b"], ["plain", 'needs "quotes", commas\nand newlines'], ["", "x"]];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
    expect(toCsv([["a", "b"]])).toBe("a,b\r\n");
    expect(toCsv([["a;b", 1, null]], ";")).toBe('"a;b";1;\r\n');
  });
});
