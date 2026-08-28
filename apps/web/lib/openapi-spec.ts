const ERROR_SCHEMA = {
  type: "object",
  properties: {
    error: {
      type: "object",
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        hint: { type: "string" },
      },
      required: ["code", "message", "hint"],
    },
  },
  required: ["error"],
};

const PHOTO_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    slug: { type: "string" },
    alt: { type: "string" },
    width: { type: "number" },
    height: { type: "number" },
    photographer: { type: "string" },
    photographerUrl: { type: "string" },
    photoUrl: { type: "string" },
    standardSrc: { type: "string" },
    gainmapSrc: { type: "string" },
  },
  required: ["id", "slug", "alt", "width", "height", "standardSrc", "gainmapSrc"],
};

const LOGO_SCHEMA = {
  type: "object",
  properties: {
    rank: { type: "number" },
    name: { type: "string" },
    slug: { type: "string" },
    svgPath: { type: "string" },
    gainmapPath: { type: "string" },
  },
  required: ["rank", "name", "slug", "svgPath", "gainmapPath"],
};

const SLUG_PARAM = {
  name: "slug",
  in: "path",
  required: true,
  schema: { type: "string" },
};

const NOT_FOUND_RESPONSE = {
  description: "Not found",
  content: { "application/json": { schema: ERROR_SCHEMA } },
};

export function buildOpenApiSpec(): object {
  return {
    openapi: "3.1.0",
    info: {
      title: "Gainmaps API",
      version: "1.1.0",
      description: "Public JSON API for the Gainmaps photo and logo catalogs, version info, and OpenAPI spec.",
    },
    servers: [{ url: "https://www.gainmaps.com" }],
    paths: {
      "/api/photos": {
        get: {
          operationId: "listPhotos",
          description: "Returns the full list of photos in the Gainmaps catalog.",
          responses: {
            "200": {
              description: "Array of photo records",
              content: { "application/json": { schema: { type: "array", items: PHOTO_SCHEMA } } },
            },
          },
        },
      },
      "/api/photos/{slug}": {
        get: {
          operationId: "getPhoto",
          description: "Returns a single photo by slug.",
          parameters: [SLUG_PARAM],
          responses: {
            "200": {
              description: "Photo record",
              content: { "application/json": { schema: PHOTO_SCHEMA } },
            },
            "404": NOT_FOUND_RESPONSE,
          },
        },
      },
      "/api/logos": {
        get: {
          operationId: "listLogos",
          description: "Returns the full list of brand logos in the Gainmaps catalog.",
          responses: {
            "200": {
              description: "Array of logo records",
              content: { "application/json": { schema: { type: "array", items: LOGO_SCHEMA } } },
            },
          },
        },
      },
      "/api/logos/{slug}": {
        get: {
          operationId: "getLogo",
          description: "Returns a single logo by slug.",
          parameters: [SLUG_PARAM],
          responses: {
            "200": {
              description: "Logo record",
              content: { "application/json": { schema: LOGO_SCHEMA } },
            },
            "404": NOT_FOUND_RESPONSE,
          },
        },
      },
      "/api/version": {
        get: {
          operationId: "getVersion",
          description: "Returns the current gainmap package version and install commands.",
          responses: {
            "200": {
              description: "Version info",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      version: { type: "string" },
                      installCommands: { type: "object" },
                      homebrewFormula: { type: "string" },
                    },
                    required: ["name", "version", "installCommands", "homebrewFormula"],
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}
