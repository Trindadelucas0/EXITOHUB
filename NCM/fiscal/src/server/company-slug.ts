export function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 2 && slug.length <= 40;
}

/** Só a empresa seed/slug `egaplast`. Nome “Egaplast” também casa. */
export function isEgaplastCompany(nameOrSlug: string | null | undefined): boolean {
  return normalizeSlug(nameOrSlug || "") === "egaplast";
}
