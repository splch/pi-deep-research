import { describe, expect, it } from "vitest";
import { fetchWithBackoff, ProviderError } from "../src/search/provider.js";

function fetchSequence(responses: Response[]): typeof fetch {
  let i = 0;
  return (async () => {
    const response = responses[Math.min(i, responses.length - 1)];
    i++;
    return response!;
  }) as typeof fetch;
}

describe("fetchWithBackoff", () => {
  it("retries 429 honoring Retry-After seconds", async () => {
    const slept: number[] = [];
    const response = await fetchWithBackoff(
      fetchSequence([
        new Response("slow down", { status: 429, headers: { "retry-after": "2" } }),
        new Response("{}", { status: 200 }),
      ]),
      "https://api.example.com/x",
      {},
      { sleep: async (ms) => void slept.push(ms) },
    );
    expect(response.status).toBe(200);
    expect(slept).toEqual([2000]);
  });

  it("uses exponential backoff when no Retry-After", async () => {
    const slept: number[] = [];
    await fetchWithBackoff(
      fetchSequence([
        new Response("", { status: 503 }),
        new Response("", { status: 503 }),
        new Response("ok", { status: 200 }),
      ]),
      "https://api.example.com/x",
      {},
      { baseDelayMs: 100, sleep: async (ms) => void slept.push(ms) },
    );
    expect(slept.length).toBe(2);
    expect(slept[0]).toBeGreaterThanOrEqual(100);
    expect(slept[1]).toBeGreaterThanOrEqual(200);
  });

  it("throws ProviderError immediately on non-retryable status", async () => {
    const slept: number[] = [];
    await expect(
      fetchWithBackoff(fetchSequence([new Response("nope", { status: 404 })]), "https://api.example.com/x", {}, {
        sleep: async (ms) => void slept.push(ms),
      }),
    ).rejects.toThrow(ProviderError);
    expect(slept).toEqual([]);
  });

  it("gives up after retries are exhausted", async () => {
    await expect(
      fetchWithBackoff(fetchSequence([new Response("", { status: 429 })]), "https://api.example.com/x", {}, {
        retries: 2,
        sleep: async () => {},
      }),
    ).rejects.toThrow(ProviderError);
  });
});
