import { describe, expect, it } from "vitest";
import { appendTail, decidePull, decidePush, formatLines, isPrefix, parseLines } from "./lines.js";

describe("parseLines / formatLines", () => {
  it("round-trips content", () => {
    const content = "a\nb\nc\n";
    expect(formatLines(parseLines(content))).toBe(content);
  });

  it("handles empty content", () => {
    expect(parseLines("")).toEqual([]);
    expect(formatLines([])).toBe("");
  });

  it("ignores a trailing newline split artifact", () => {
    expect(parseLines("a\n")).toEqual(["a"]);
  });
});

describe("isPrefix", () => {
  it("detects true prefixes", () => {
    expect(isPrefix(["a", "b"], ["a", "b", "c"])).toBe(true);
    expect(isPrefix([], ["a"])).toBe(true);
    expect(isPrefix(["a"], ["a"])).toBe(true);
  });

  it("rejects non-prefixes", () => {
    expect(isPrefix(["a", "x"], ["a", "b"])).toBe(false);
    expect(isPrefix(["a", "b", "c"], ["a", "b"])).toBe(false);
  });
});

describe("decidePull", () => {
  it("writes when remote is ahead", () => {
    expect(decidePull(["a"], ["a", "b"])).toBe("write");
    expect(decidePull([], ["a"])).toBe("write");
  });

  it("skips when local is equal or ahead", () => {
    expect(decidePull(["a", "b"], ["a", "b"])).toBe("skip");
    expect(decidePull(["a", "b", "c"], ["a", "b"])).toBe("skip");
  });
});

describe("decidePush", () => {
  it("creates when there is no remote document", () => {
    expect(decidePush(["a"], null)).toBe("create");
    expect(decidePush([], null)).toBe("skip");
  });

  it("skips when remote is equal or ahead", () => {
    expect(decidePush(["a", "b"], ["a", "b"])).toBe("skip");
    expect(decidePush(["a"], ["a", "b"])).toBe("skip");
  });

  it("appends when local extends remote", () => {
    expect(decidePush(["a", "b", "c"], ["a", "b"])).toBe("append");
  });

  it("replaces when histories diverged", () => {
    expect(decidePush(["a", "x"], ["a", "b"])).toBe("replace");
    expect(decidePush(["x"], ["a"])).toBe("replace");
  });
});

describe("appendTail", () => {
  it("returns only the lines beyond the remote length", () => {
    expect(appendTail(["a", "b", "c"], ["a", "b"])).toEqual(["c"]);
    expect(appendTail(["a"], ["a"])).toEqual([]);
  });
});
