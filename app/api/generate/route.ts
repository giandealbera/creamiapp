import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

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

// CSS skeleton pre-defined: Claude only generates body content, zero tokens wasted on CSS
const HTML_SKELETON = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mi App</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Tahoma,sans-serif;background:#f8f9fa;color:#333;line-height:1.7}nav{background:#1a1a2e;color:white;padding:16px 32px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px}nav a{color:#ddd;text-decoration:none;margin-left:20px;font-size:.95rem}nav a:hover{color:#fff}header{background:linear-gradient(135deg,#1a1a2e,#0f3460);color:white;padding:80px 32px;text-align:center}header h1{font-size:2.6rem;font-weight:900;margin-bottom:16px;line-height:1.2}header p{font-size:1.1rem;opacity:.85;max-width:600px;margin:0 auto 28px}h2{font-size:1.9rem;font-weight:800;color:#1a1a2e;margin:0 0 8px}h3{font-size:1.15rem;font-weight:700;color:#1a1a2e;margin:0 0 8px}section{padding:60px 32px;max-width:1000px;margin:0 auto}p{color:#555;margin:0 0 14px}ul,ol{padding-left:22px;margin-bottom:16px}li{color:#555;margin-bottom:6px}.cards{display:flex;flex-wrap:wrap;gap:20px;margin-top:24px}.card{background:white;padding:24px;border-radius:14px;box-shadow:0 3px 16px rgba(0,0,0,.09);flex:1;min-width:220px}.card h3{margin-bottom:10px}.icon{font-size:2rem;margin-bottom:12px}button,.btn{background:#e94560;color:white;border:none;padding:13px 32px;border-radius:30px;cursor:pointer;font-size:1rem;font-weight:700;text-decoration:none;display:inline-block}button:hover,.btn:hover{opacity:.88}table{width:100%;border-collapse:collapse;background:white;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);margin:16px 0}th{background:#1a1a2e;color:white;padding:14px 16px;text-align:left;font-size:.88rem}td{padding:13px 16px;border-bottom:1px solid #f0f0f0;color:#444}tr:last-child td{border-bottom:none}tr:hover td{background:#f8f9fa}form{background:white;padding:36px;border-radius:14px;box-shadow:0 3px 16px rgba(0,0,0,.09);max-width:600px;margin:0 auto}label{display:block;font-weight:600;font-size:.9rem;margin-bottom:6px;color:#333}input,textarea,select{width:100%;padding:12px 14px;margin-bottom:18px;border:2px solid #e0e0e0;border-radius:8px;font-size:.95rem;font-family:inherit;outline:none}input:focus,textarea:focus{border-color:#e94560}.highlight{background:#1a1a2e;color:white;padding:60px 32px;text-align:center}.highlight h2{color:white}.highlight p{color:rgba(255,255,255,.8)}footer{background:#1a1a2e;color:#aaa;text-align:center;padding:40px 32px}footer strong{color:white}@media(max-width:640px){header h1{font-size:1.9rem}section{padding:40px 16px}nav{padding:14px 20px}.cards{flex-direction:column}}</style></head><body>`;
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

    const stream = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      stream: true,
      messages: [
        {
          role: "user",
          content:
            "Genera el contenido HTML del body para una pagina web en espanol sobre: " +
            JSON.stringify(sanitizedIdea) +
            "\nReglas:\n" +
            "- Escribe SOLO el contenido del body (SIN DOCTYPE, html, head ni style)\n" +
            "- Usa etiquetas estandar: nav, header, section, footer, h1, h2, h3, p, ul, li, table, form\n" +
            "- Para cards: <div class='cards'><div class='card'><div class='icon'>EMOJI</div><h3>Titulo</h3><p>Texto</p></div></div>\n" +
            "- Contenido abundante, real y especifico al tema en espanol\n" +
            "- Termina siempre con </body></html>",
        },
        {
          role: "assistant",
          content: HTML_SKELETON,
        },
      ],
    });

    const skeletonBytes = new TextEncoder().encode(HTML_SKELETON);

    const readable = new ReadableStream({
      async start(controller) {
        // Send pre-defined skeleton first (CSS already included, no tokens wasted)
        controller.enqueue(skeletonBytes);
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
