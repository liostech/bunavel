/**
 * String helper class inspired by Laravel's Str class
 */
export class Str {
  /**
   * Convert string to camelCase
   */
  static camel(str: string): string {
    return str
      .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
      .replace(/^[A-Z]/, c => c.toLowerCase());
  }

  /**
   * Convert string to PascalCase (StudlyCase)
   */
  static studly(str: string): string {
    return str
      .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
      .replace(/^[a-z]/, c => c.toUpperCase());
  }

  /**
   * Convert string to snake_case
   */
  static snake(str: string, delimiter: string = "_"): string {
    return str
      .replace(/([A-Z])/g, `${delimiter}$1`)
      .replace(/[-_\s]+/g, delimiter)
      .toLowerCase()
      .replace(new RegExp(`^${delimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), "");
  }

  /**
   * Convert string to kebab-case
   */
  static kebab(str: string): string {
    return this.snake(str, "-");
  }

  /**
   * Convert string to Title Case
   */
  static title(str: string): string {
    return str
      .toLowerCase()
      .split(/[\s_-]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  /**
   * Get the substring after the first occurrence of a value
   */
  static after(str: string, search: string): string {
    const index = str.indexOf(search);
    return index === -1 ? str : str.slice(index + search.length);
  }

  /**
   * Get the substring after the last occurrence of a value
   */
  static afterLast(str: string, search: string): string {
    const index = str.lastIndexOf(search);
    return index === -1 ? str : str.slice(index + search.length);
  }

  /**
   * Get the substring before the first occurrence of a value
   */
  static before(str: string, search: string): string {
    const index = str.indexOf(search);
    return index === -1 ? str : str.slice(0, index);
  }

  /**
   * Get the substring before the last occurrence of a value
   */
  static beforeLast(str: string, search: string): string {
    const index = str.lastIndexOf(search);
    return index === -1 ? str : str.slice(0, index);
  }

  /**
   * Check if string contains a substring
   */
  static contains(str: string, search: string | string[]): boolean {
    if (Array.isArray(search)) {
      return search.some(s => str.includes(s));
    }
    return str.includes(search);
  }

  /**
   * Check if string starts with a substring
   */
  static startsWith(str: string, search: string | string[]): boolean {
    if (Array.isArray(search)) {
      return search.some(s => str.startsWith(s));
    }
    return str.startsWith(search);
  }

  /**
   * Check if string ends with a substring
   */
  static endsWith(str: string, search: string | string[]): boolean {
    if (Array.isArray(search)) {
      return search.some(s => str.endsWith(s));
    }
    return str.endsWith(search);
  }

  /**
   * Limit string to a number of characters
   */
  static limit(str: string, limit: number, end: string = "..."): string {
    if (str.length <= limit) return str;
    return str.slice(0, limit) + end;
  }

  /**
   * Limit string to a number of words
   */
  static words(str: string, words: number, end: string = "..."): string {
    const wordArray = str.split(/\s+/);
    if (wordArray.length <= words) return str;
    return wordArray.slice(0, words).join(" ") + end;
  }

  /**
   * Generate a random string
   */
  static random(length: number = 16): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Repeat string n times
   */
  static repeat(str: string, times: number): string {
    return str.repeat(times);
  }

  /**
   * Replace first occurrence
   */
  static replaceFirst(str: string, search: string, replace: string): string {
    const index = str.indexOf(search);
    if (index === -1) return str;
    return str.slice(0, index) + replace + str.slice(index + search.length);
  }

  /**
   * Replace last occurrence
   */
  static replaceLast(str: string, search: string, replace: string): string {
    const index = str.lastIndexOf(search);
    if (index === -1) return str;
    return str.slice(0, index) + replace + str.slice(index + search.length);
  }

  /**
   * Pluralize a word (simple English rules)
   */
  static plural(word: string, count?: number): string {
    if (count === 1) return word;

    const rules: [RegExp, string][] = [
      [/s$/i, "s"],
      [/(ss|x|z|ch|sh)$/i, "$1es"],
      [/([^aeiou])y$/i, "$1ies"],
      [/$/i, "s"],
    ];

    for (const [pattern, replacement] of rules) {
      if (pattern.test(word)) {
        return word.replace(pattern, replacement);
      }
    }

    return word + "s";
  }

  /**
   * Singularize a word (simple English rules)
   */
  static singular(word: string): string {
    const rules: [RegExp, string][] = [
      [/(ss|x|z|ch|sh)es$/i, "$1"],
      [/([^aeiou])ies$/i, "$1y"],
      [/s$/i, ""],
    ];

    for (const [pattern, replacement] of rules) {
      if (pattern.test(word)) {
        return word.replace(pattern, replacement);
      }
    }

    return word;
  }

  /**
   * Pad both sides of string
   */
  static padBoth(str: string, length: number, pad: string = " "): string {
    const totalPad = length - str.length;
    if (totalPad <= 0) return str;

    const leftPad = Math.floor(totalPad / 2);
    const rightPad = totalPad - leftPad;

    return pad.repeat(leftPad) + str + pad.repeat(rightPad);
  }

  /**
   * Remove all whitespace
   */
  static squish(str: string): string {
    return str.replace(/\s+/g, " ").trim();
  }

  /**
   * Reverse a string
   */
  static reverse(str: string): string {
    return str.split("").reverse().join("");
  }
}

/**
 * Helper function for string operations
 */
export function str(value: string) {
  return {
    camel: () => Str.camel(value),
    studly: () => Str.studly(value),
    snake: (delimiter?: string) => Str.snake(value, delimiter),
    kebab: () => Str.kebab(value),
    title: () => Str.title(value),
    after: (search: string) => Str.after(value, search),
    afterLast: (search: string) => Str.afterLast(value, search),
    before: (search: string) => Str.before(value, search),
    beforeLast: (search: string) => Str.beforeLast(value, search),
    contains: (search: string | string[]) => Str.contains(value, search),
    startsWith: (search: string | string[]) => Str.startsWith(value, search),
    endsWith: (search: string | string[]) => Str.endsWith(value, search),
    limit: (limit: number, end?: string) => Str.limit(value, limit, end),
    words: (words: number, end?: string) => Str.words(value, words, end),
    repeat: (times: number) => Str.repeat(value, times),
    replaceFirst: (search: string, replace: string) => Str.replaceFirst(value, search, replace),
    replaceLast: (search: string, replace: string) => Str.replaceLast(value, search, replace),
    plural: (count?: number) => Str.plural(value, count),
    singular: () => Str.singular(value),
    padBoth: (length: number, pad?: string) => Str.padBoth(value, length, pad),
    squish: () => Str.squish(value),
    reverse: () => Str.reverse(value),
    toString: () => value,
  };
}
