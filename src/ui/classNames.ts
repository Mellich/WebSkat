/** Joins the class names that are present. */
export function cls(...names: readonly (string | false | null | undefined)[]): string {
  return names.filter((n): n is string => typeof n === 'string' && n.length > 0).join(' ');
}
