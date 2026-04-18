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
      "Genera una pagina HTML completa para: " +
      JSON.stringify(sanitizedIdea) +
      "\n\nREGLAS ESTRICTAS:\n" +
      "- Un solo archivo HTML con todo inline\n" +
      "- Usa UN bloque <style> MUY CORTO (maximo 30 lineas de CSS), sin comentarios\n" +
      "- El CSS debe ser minimalista: solo colores de fondo, fuente, padding basico\n" +
      "- Todo el contenido visible debe estar en el <body> con texto real en espanol\n" +
      "- Diseno moderno con colores atractivos\n" +
      "- Navegacion con href='#id' solamente, sin JS complejo\n" +
      "- Contenido de ejemplo realista y abundante (titulos, parrafos, listas)\n" +
      "- IMPORTANTE: el HTML debe estar 100% completo, con </html> al final\n" +
      "- Responde SOLO con el codigo comenzando exactamente con <!DOCTYPE html>";

    const stream = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1600,
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
