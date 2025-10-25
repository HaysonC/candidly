module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[project]/programs/ANTICLUELY/app/lib/templatesStore.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Simple in-memory store for interview templates (dev-only)
__turbopack_context__.s([
    "createTemplate",
    ()=>createTemplate,
    "getTemplate",
    ()=>getTemplate,
    "listTemplates",
    ()=>listTemplates,
    "updateTemplate",
    ()=>updateTemplate
]);
const templates = [];
function listTemplates() {
    return templates;
}
function getTemplate(id) {
    return templates.find((t)=>t.id === id);
}
function createTemplate(input) {
    const t = {
        id: Date.now().toString(),
        ...input
    };
    templates.push(t);
    return t;
}
function updateTemplate(id, input) {
    const idx = templates.findIndex((t)=>t.id === id);
    if (idx === -1) return undefined;
    const prev = templates[idx];
    const next = {
        ...prev,
        ...input
    };
    templates[idx] = next;
    return next;
}
}),
"[project]/programs/ANTICLUELY/app/app/api/templates/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$programs$2f$ANTICLUELY$2f$app$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/programs/ANTICLUELY/app/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$programs$2f$ANTICLUELY$2f$app$2f$lib$2f$templatesStore$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/programs/ANTICLUELY/app/lib/templatesStore.ts [app-route] (ecmascript)");
;
;
async function GET() {
    return __TURBOPACK__imported__module__$5b$project$5d2f$programs$2f$ANTICLUELY$2f$app$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json((0, __TURBOPACK__imported__module__$5b$project$5d2f$programs$2f$ANTICLUELY$2f$app$2f$lib$2f$templatesStore$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["listTemplates"])());
}
async function POST(req) {
    const body = await req.json();
    const { name = 'Untitled Template', criteria = [], coding_questions = [] } = body || {};
    const created = (0, __TURBOPACK__imported__module__$5b$project$5d2f$programs$2f$ANTICLUELY$2f$app$2f$lib$2f$templatesStore$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createTemplate"])({
        name,
        criteria,
        coding_questions
    });
    return __TURBOPACK__imported__module__$5b$project$5d2f$programs$2f$ANTICLUELY$2f$app$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(created);
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__96ba895a._.js.map