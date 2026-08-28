import { describe, it, expect } from "vitest";
import { GET } from "@/app/openapi.json/route";
import { GET as wellKnownOpenApiGet } from "@/app/.well-known/openapi.json/route";
import { GET as swaggerGet } from "@/app/swagger.json/route";
import { buildOpenApiSpec } from "@/lib/openapi-spec";

describe("GET /openapi.json", () => {
  it("returns 200 with JSON", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("openapi");
    expect(data).toHaveProperty("paths");
  });
});

describe("buildOpenApiSpec", () => {
  it("every operation has operationId, description, responses", () => {
    const spec = buildOpenApiSpec() as { paths: Record<string, Record<string, { operationId?: string; description?: string; responses?: unknown }>> };
    for (const pathItem of Object.values(spec.paths)) {
      for (const op of Object.values(pathItem)) {
        expect(op.operationId).toBeDefined();
        expect(op.description).toBeDefined();
        expect(op.responses).toBeDefined();
      }
    }
  });

  it("includes all expected paths", () => {
    const spec = buildOpenApiSpec() as { paths: Record<string, unknown> };
    expect(spec.paths["/api/photos"]).toBeDefined();
    expect(spec.paths["/api/photos/{slug}"]).toBeDefined();
    expect(spec.paths["/api/logos"]).toBeDefined();
    expect(spec.paths["/api/logos/{slug}"]).toBeDefined();
    expect(spec.paths["/api/version"]).toBeDefined();
  });
});

async function assertOpenApiAlias(get: () => Promise<Response>): Promise<void> {
  const res = await get();
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data).toHaveProperty("openapi", "3.1.0");
  expect(data).toHaveProperty("paths");
  expect(data.paths["/api/photos"]).toBeDefined();
  expect(data.paths["/api/logos"]).toBeDefined();
  expect(data.paths["/api/version"]).toBeDefined();
}

describe("OpenAPI alias routes", () => {
  it("GET /.well-known/openapi.json matches canonical spec", async () => {
    await assertOpenApiAlias(wellKnownOpenApiGet);
  });

  it("GET /swagger.json matches canonical spec", async () => {
    await assertOpenApiAlias(swaggerGet);
  });
});
