import { generateText, Output, createGateway, gateway } from "ai"
import { z } from "zod"

export const maxDuration = 30

// Resolve a working AI Gateway model. Prefer the Vercel OIDC token (present in
// both the v0 sandbox and on Vercel), falling back to the default key-based
// gateway when no OIDC token is available.
function visionModel() {
  const oidcToken = process.env.VERCEL_OIDC_TOKEN
  const provider = oidcToken ? createGateway({ apiKey: oidcToken }) : gateway
  return provider("openai/gpt-4o")
}

// Extracts actionable to-do items from a photo of notes or a screenshot.
export async function POST(req: Request) {
  let image: unknown
  try {
    ;({ image } = await req.json())
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 })
  }

  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return Response.json({ error: "Please provide an image." }, { status: 400 })
  }

  // Pull the media type out of the data URL (e.g. "image/png").
  const mediaType = image.slice(5, image.indexOf(";"))

  try {
    const { output } = await generateText({
      model: visionModel(),
      output: Output.object({
        schema: z.object({
          tasks: z
            .array(z.string())
            .describe("Each actionable to-do item, as a concise imperative task title with no bullet or number prefix."),
        }),
      }),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "This image is a photo of handwritten notes or a screenshot. " +
                "Read it and extract every actionable to-do / task. " +
                "Return each task as a short, clear imperative title (e.g. 'Send Q3 numbers to finance'). " +
                "Strip any bullet characters, checkboxes, or numbering. " +
                "Ignore headings, dates, and text that isn't a task. " +
                "If there are no tasks, return an empty list.",
            },
            { type: "file", mediaType, data: image },
          ],
        },
      ],
    })

    const tasks = (output.tasks ?? []).map((t) => t.trim()).filter(Boolean)
    return Response.json({ tasks })
  } catch (err) {
    console.log("[v0] extract-tasks failed:", (err as Error)?.message)
    return Response.json({ error: "Could not read that image. Please try another photo." }, { status: 500 })
  }
}
