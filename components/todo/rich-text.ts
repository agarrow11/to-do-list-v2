// Notes are stored as lightweight HTML (emphasis, lists, fonts, sizes, and colors).
// These helpers keep the rest of the app working with that format and stay
// backward-compatible with older plain-text notes.

const HTML_TAG = /<[a-z][\s\S]*>/i

/** Convert a stored note into HTML for the editor.
 *  Older notes were plain text — escape them and preserve line breaks. */
export function notesToHtml(notes: string): string {
  if (!notes) return ""
  if (HTML_TAG.test(notes)) return notes
  const escaped = notes.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  return escaped.replace(/\n/g, "<br>")
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
}

/** True when the HTML note contains real text (ignoring empty tags / <br>). */
export function htmlHasContent(html: string): boolean {
  if (!html) return false
  const text = decodeEntities(html.replace(/<[^>]+>/g, ""))
  return text.trim().length > 0
}

/** Flatten HTML notes to readable plain text (for the Excel export).
 *  Bulleted items become "• …" and block elements become new lines. */
export function htmlToPlainText(html: string): string {
  if (!html) return ""
  if (!HTML_TAG.test(html)) return html // already plain text
  let s = html
  s = s.replace(/<li[^>]*>/gi, "\n• ").replace(/<\/li>/gi, "")
  s = s.replace(/<\/(p|div|ul|ol|h[1-6])>/gi, "\n")
  s = s.replace(/<br\s*\/?>/gi, "\n")
  s = s.replace(/<[^>]+>/g, "")
  s = decodeEntities(s)
  s = s.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n").trim()
  return s
}
