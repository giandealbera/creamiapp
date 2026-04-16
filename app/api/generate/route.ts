import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { idea } = await req.json();

    if (!idea || idea.trim() === "") {
      return NextResponse.json({ error: "Falta la descripción de la idea." }, { status: 400 });
    }

    const message = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 8096,
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

    const html = (message.content[0] as { type: string; text: string }).text;

    const cleanHtml = html.replace(/^```html\n?/, "").replace(/\n?```$/, "").trim();

    return NextResponse.json({ html: cleanHtml });
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number };
    console.error("Error al generar:", error);
    return NextResponse.json({
      error: `Error: ${err?.message || "Desconocido"}`
    }, { status: 500 });
  }
}
