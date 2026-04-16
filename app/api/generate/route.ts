import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { idea } = await req.json();

    if (!idea || idea.trim() === "") {
      return new Response(JSON.stringify({ error: "Falta la descripción de la idea." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const stream = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8096,
      stream: true,
      messages: [
        {
          role: "user",
          content: `Sos un generador de páginas web. El usuario describió lo que quiere crear:

"${idea}"

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
      },
    });
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number };
    console.error("Error al generar:", error);
    return new Response(
      JSON.stringify({ error: `Error: ${err?.message || "Desconocido"}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
