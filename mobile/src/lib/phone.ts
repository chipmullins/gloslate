/** "+15025550101" → "(502) 555-0101"; anything else as is. */
export function prettyPhone(p: string) {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(p);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : p;
}
