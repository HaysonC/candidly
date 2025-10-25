// Simple in-memory store for interview templates (dev-only)
export type Template = {
  id: string;
  name: string;
  criteria: string[]; // freeform lines describing areas; frontend/agent will map to areas later
  coding_questions: string[]; // freeform question prompts; agent/backend can expand later
};

const templates: Template[] = [];

export function listTemplates(): Template[] {
  return templates;
}

export function getTemplate(id: string): Template | undefined {
  return templates.find((t) => t.id === id);
}

export function createTemplate(input: Omit<Template, "id">): Template {
  const t: Template = { id: Date.now().toString(), ...input };
  templates.push(t);
  return t;
}

export function updateTemplate(id: string, input: Partial<Omit<Template, "id">>): Template | undefined {
  const idx = templates.findIndex((t) => t.id === id);
  if (idx === -1) return undefined;
  const prev = templates[idx];
  const next: Template = {
    ...prev,
    ...input,
  };
  templates[idx] = next;
  return next;
}
