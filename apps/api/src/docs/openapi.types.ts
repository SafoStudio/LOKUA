export interface OpenApiSpec {
  openapi: string;
  info: Record<string, unknown>;
  servers: Array<{
    url: string;
    description?: string;
  }>;
  tags?: Array<{
    name: string;
    description?: string;
    'x-displayName'?: string;
  }>;
  'x-tagGroups'?: Array<{
    name: string;
    tags: string[];
  }>;
  paths: Record<string, unknown>;
  components: {
    schemas: Record<string, unknown>;
    securitySchemes: Record<string, unknown>;
  };
}
