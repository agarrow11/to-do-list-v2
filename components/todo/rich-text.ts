// Notes are stored as lightweight HTML (bold / italic / underline / bulleted list).
// These helpers keep the rest of the app working with that format and stay
// backward-compatible with older plain-text notes.

const HTML_TAG = /<[a-z][\s\S]*>/i

/** Convert a stored note into HTML for the editor.
 *  Older notes were plain text — escape them and preserve line breaks. */
export function notesToHtml(notes: string): string {
  if (!notes) return ""
  if (HTML_TAG.test(notes)) return notes

  // Some earlier builds saved rich text as escaped markup. Decode it only when
  // it clearly contains supported note tags; ordinary text such as "a < b"
  // must remain ordinary text.
  const decoded = decodeEntities(notes)
  if (/<(p|div|span|br|ul|ol|li|strong|b|em|i|u|s|strike)\b/i.test(decoded)) return decoded

  const escaped = notes.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  return escaped.replace(/\n/g, "<br>")
}

const ALLOWED_TAGS = new Set(["P", "DIV", "SPAN", "BR", "UL", "OL", "LI", "STRONG", "B", "EM", "I", "U", "S", "STRIKE"])
const ALLOWED_STYLES = new Set(["font-family", "font-size", "color", "background-color"])

/** Remove Word/Outlook metadata and unsupported formatting before displaying
 * or saving a note. This prevents copied Office markup from changing the
 * editor typography or appearing as raw HTML. */
export function sanitizeNotesHtml(notes: string): string {
  const html = notesToHtml(notes)
  if (!html || typeof DOMParser === "undefined") return html

  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html")
  const root = doc.body.firstElementChild as HTMLElement | null
  if (!root) return ""

  for (const element of Array.from(root.querySelectorAll("*"))) {
    if (!ALLOWED_TAGS.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes))
      continue
    }

    const style = (element as HTMLElement).style
    const officeMarkup =
      element.hasAttribute("data-contrast") ||
      element.hasAttribute("xml:lang") ||
      /(^|\s)Mso/i.test(element.getAttribute("class") ?? "") ||
      /(^|;)\s*mso-/i.test(element.getAttribute("style") ?? "")
    const kept: string[] = []
    if (!officeMarkup) {
      for (const property of ALLOWED_STYLES) {
        const value = style.getPropertyValue(property).trim()
        if (value && !/url\s*\(|expression\s*\(|javascript:/i.test(value)) kept.push(`${property}: ${value}`)
      }
    }
    for (const attribute of Array.from(element.attributes)) element.removeAttribute(attribute.name)
    if (kept.length > 0) element.setAttribute("style", kept.join("; "))
  }

  return root.innerHTML
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
