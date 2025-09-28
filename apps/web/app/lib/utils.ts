// apps/web/lib/utils.ts
type ClassValue = string | number | null | false | undefined | ClassValue[] | Record<string, boolean>;

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  const push = (v: ClassValue) => {
    if (!v) return;
    if (typeof v === "string" || typeof v === "number") out.push(String(v));
    else if (Array.isArray(v)) v.forEach(push);
    else for (const k in v) if (v[k]) out.push(k);
  };
  inputs.forEach(push);
  return out.join(" ");
}
