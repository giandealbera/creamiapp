import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

// Edge runtime: streaming nativo, sin limite de servidor
export const runtime = "edge";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MAX_IDEA_LENGTH = 2000;

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return jsonError("Solicitud invalida.", 400);

    const { idea } = body;

    if (!idea || idea.trim() === "") {
      return jsonError("Falta la descripcion de la idea.", 400);
    }

    if (idea.length > MAX_IDEA_LENGTH) {
      return jsonError("La descripcion no puede superar los " + MAX_IDEA_LENGTH + " caracteres.", 400);
    }

    const sanitizedIdea = idea.replace(/`/g, "'").trim();

    const prompt =
      "Sos un generador de paginas web. Crea una pagina HTML completa y funcional para: " +
      JSON.stringify(sanitizedIdea) +
      "\n\nREGLAS ESTRICTAS:\n" +
      "- Un solo archivo HTML con CSS y JS inline\n" +
      "- Diseno moderno, colores atractivos, responsive\n" +
      "- Contenido de ejemplo realista en espanol\n" +
      "- CSS MUY CONCISO: usa variables CSS, sin comentarios\n" +
      "- SIN comentarios en HTML ni CSS\n" +
      "- Todos los tags cerrados correctamente incluyendo </body> y </html>\n" +
      "- Navegacion interna con href='#seccion' (no URLs relativas)\n" +
      "- SOLO codigo HTML puro comenzando con <!DOCTYPE html>, sin markdown ni explicaciones";

    const stream = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2500,
      stream: true,
      messages: [{ role: "user", content: prompt }],
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
    return jsonError("Error: " + (err?.message || "Desconocido"), err?.status || 500);
  }
}
