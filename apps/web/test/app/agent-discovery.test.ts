import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GET as agentsGet } from "@/app/agents.txt/route";
import { GET as aiGet } from "@/app/ai.txt/route";
import { GET as wellKnownLlmsGet } from "@/app/.well-known/llms.txt/route";

async function publicLlmsText(): Promise<string> {
  return readFile(join(process.cwd(), "public/llms.txt"), "utf8");
}

async function expectLlmsAlias(get: () => Promise<Response>): Promise<void> {
  const res = await get();
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("text/plain");
  expect(res.headers.get("cache-control")).toContain("max-age=3600");
  await expect(res.text()).resolves.toBe(await publicLlmsText());
}

describe("agent discovery text aliases", () => {
  it("serves /agents.txt from public llms.txt", async () => {
    await expectLlmsAlias(agentsGet);
  });

  it("serves /ai.txt from public llms.txt", async () => {
    await expectLlmsAlias(aiGet);
  });

  it("serves /.well-known/llms.txt from public llms.txt", async () => {
    await expectLlmsAlias(wellKnownLlmsGet);
  });
});
