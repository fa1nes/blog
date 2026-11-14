/** @param {unknown} value */
export function serializeJsonLd(value) {
  const json = JSON.stringify(value);
  if (json === undefined) throw new TypeError('JSON-LD data must be JSON serializable.');

  return json.replace(/[<>&\u2028\u2029]/g, (character) =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}
