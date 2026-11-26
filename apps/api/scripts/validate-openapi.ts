import { loadOpenApiDocument } from '../src/docs/index.js';

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function walk(node: unknown, visit: (obj: AnyRecord) => void): void {
    if (Array.isArray(node)) {
        for (const item of node) walk(item, visit);
        return;
    }

    if (isRecord(node)) {
        visit(node);
        for (const value of Object.values(node)) walk(value, visit);
    }
}

console.log('🚀 Starting OpenAPI validation...\n');

const doc = loadOpenApiDocument();

const schemas = new Set(Object.keys(doc.components.schemas));
const securitySchemes = new Set(Object.keys(doc.components.securitySchemes));

const errors: string[] = [];
const usedTags = new Set<string>();

// Validate $ref references
console.log('🔍 Checking $ref references...');

walk(doc, (obj) => {
    if (typeof obj.$ref !== 'string') return;

    const match = obj.$ref.match(
        /^#\/components\/(schemas|securitySchemes)\/([^/]+)$/,
    );

    if (!match) {
        errors.push(`Unsupported $ref format: ${obj.$ref}`);
        return;
    }

    const [, section, name] = match;

    if (section === 'schemas' && !schemas.has(name)) {
        errors.push(`Unresolved $ref: #/components/schemas/${name}`);
    }

    if (section === 'securitySchemes' && !securitySchemes.has(name)) {
        errors.push(`Unresolved $ref: #/components/securitySchemes/${name}`);
    }
});

// Collect tags used in paths
console.log('🔍 Checking OpenAPI tags...');

for (const pathItem of Object.values(doc.paths) as AnyRecord[]) {
    if (!isRecord(pathItem)) continue;

    for (const method of [
        'get',
        'post',
        'put',
        'patch',
        'delete',
        'head',
        'options',
        'trace',
    ]) {
        const op = pathItem[method];

        if (!isRecord(op)) continue;

        if (Array.isArray(op.tags)) {
            for (const tag of op.tags) {
                if (typeof tag === 'string') {
                    usedTags.add(tag);
                }
            }
        }
    }
}

// Validate declared tags
const declaredTags = new Set((doc.tags ?? []).map((tag) => tag.name));

usedTags.forEach((tag) => {
    if (!declaredTags.has(tag)) {
        errors.push(
            `Tag "${tag}" is used in paths but not declared in root "tags"`,
        );
    }
});

// Print validation results
if (errors.length > 0) {
    console.error(`\n❌ FAIL: OpenAPI validation failed (${errors.length} errors)\n`);

    errors.forEach((err) => {
        console.error(`  ❌ ${err}`);
    });

    console.error('\n💥 OpenAPI validation aborted.');

    process.exit(1);
}

console.log('✅ $ref references are valid.');
console.log('✅ OpenAPI tags are valid.');

console.log('\n🎉 OPENAPI VALIDATION PASSED SUCCESSFULLY!');

console.log(
    `📊 Summary: ${Object.keys(doc.paths).length} paths | ` +
    `${schemas.size} schemas | ` +
    `${securitySchemes.size} security schemes | ` +
    `${usedTags.size} tags`,
);
