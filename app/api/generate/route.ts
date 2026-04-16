import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MAX_IDEA_LENGTH = 2000;

// Simple in-memory rate limiting (resets on cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // requests per window
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  // Rate limiting
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  if (!checkRateLimit(ip)) {
    return jsonError("Límite de generaciones alcanzado. Intentá de nuevo en una hora.", 429);
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body) return jsonError("Solicitud inválida.", 400);

    const { idea } = body;

    if (!idea || idea.trim() === "") {
      return jsonError("Falta la descripción de la idea.", 400);
    }

    if (idea.length > MAX_IDEA_LENGTH) {
      return jsonError(`La descripción no puede superar los ${MAX_IDEA_LENGTH} caracteres.`, 400);
    }

    // Sanitize: strip any attempt to break out of the prompt
    const sanitizedIdea = idea.replace(/`/g, "'").trim();

    const stream = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8096,
      stream: true,
      messages: [
        {
          role: "user",
          content: `Sos un generador de páginas web. El usuario describió lo que quiere crear:

"${sanitizedIdea}"

Generá una página web HTML completa, moderna y profesional que cumpla con esa descripción.
Requisitos:
- Todo en un solo archivo HTML (CSS y JS incluidos inline)
- Diseño moderno, con colores atractivos y tipografía limpia
- Responsive (que se vea bien en celular y computadora)
- Contenido de ejemplo realista en español
- CSS conciso: usá variables CSS y evitá repetición innecesaria
- NO incluyas comentarios en el CSS ni HTML
- IMPORTANTE: El archivo debe estar completo. Asegurate de cerrar todos los tags, incluyendo </body> y </html>
- Para la navegación entre secciones, usá siempre links ancla (href="#seccion") en lugar de URLs relativas (/pagina). La página se mostrará en un iframe de vista previa.
- NO incluyas explicaciones ni markdown, solo el código HTML puro comenzando con <!DOCTYPE html>`,
        },
      ],
    });

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              controller.enqueue(new TextEncoder().encode(chunk.delta.text));
            }
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number };
    console.error("Error al generar:", error);
    return jsonError(`Error: ${err?.message || "Desconocido"}`, err?.status || 500);
  }
}
