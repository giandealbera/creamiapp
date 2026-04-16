"use client";

import { useState } from "react";

const IFRAME_GUARD = `<base target="_blank"><script>(function(){document.addEventListener('click',function(e){var el=e.target;while(el&&el.tagName!=='A')el=el.parentElement;if(el&&el.tagName==='A'){var h=el.getAttribute('href')||'';if(h&&!h.startsWith('#')&&!h.startsWith('http')&&!h.startsWith('mailto')&&!h.startsWith('tel')){e.preventDefault();}}},true);})();<\/script>`;

export default function Home() {
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [streamingCode, setStreamingCode] = useState("");
  const [error, setError] = useState("");
  const [showPaywall, setShowPaywall] = useState(false);

  const ejemplos = [
    "Una tienda de ropa con carrito de compras y sección de contacto",
    "Un portfolio personal para fotógrafo con galería de fotos",
    "Una página para un restaurante con menú y reservas",
    "Una landing page para una app de delivery de comida",
  ];

  async function generar() {
    if (!idea.trim()) return;
    setLoading(true);
    setError("");
    setGeneratedHtml("");
    setStreamingCode("");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error || "Hubo un problema. Intentá de nuevo.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setStreamingCode(accumulated);
      }

      // Limpiar markdown si Claude lo agregó
      const cleanHtml = accumulated
        .replace(/^```html\n?/, "")
        .replace(/\n?```$/, "")
        .trim();

      // Inyectar protecciones para el iframe
      const fixedHtml = cleanHtml.replace(
        /<head([^>]*)>/i,
        `<head$1>${IFRAME_GUARD}`
      );

      setStreamingCode("");
      setGeneratedHtml(fixedHtml);
    } catch {
      setError("Hubo un problema de conexión. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  function descargar() {
    const blob = new Blob([generatedHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mi-app.html";
    a.click();
    URL.revokeObjectURL(url);
  }

  const slugEjemplo =
    idea
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .join("-") || "mi-app";

  const streamingLines = streamingCode.split("\n");
  const visibleLines = streamingLines.slice(-12).join("\n");
  const progress = Math.min((streamingCode.length / 60), 95);

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f13", color: "#fff", fontFamily: "'Segoe UI', sans-serif" }}>

      {/* MODAL PAYWALL */}
      {showPaywall && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowPaywall(false); }}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
          }}
        >
          <div style={{
            background: "#16161e", border: "1px solid #2a2a3a", borderRadius: 20,
            maxWidth: 480, width: "100%", padding: "36px 32px", position: "relative",
          }}>
            <button
              onClick={() => setShowPaywall(false)}
              style={{ position: "absolute", top: 16, right: 16, background: "transparent", border: "none", color: "#555", fontSize: "1.3rem", cursor: "pointer" }}
            >✕</button>

            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🚀</div>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: 8 }}>
                Publicá tu app online
              </h2>
              <p style={{ color: "#aaa", fontSize: "0.9rem", lineHeight: 1.5 }}>
                Tu página estará disponible en internet con tu propia URL, lista para compartir con tus clientes.
              </p>
            </div>

            <div style={{ background: "#0f0f13", border: "1px solid #3a3660", borderRadius: 10, padding: "12px 16px", marginBottom: 24, textAlign: "center" }}>
              <div style={{ color: "#555", fontSize: "0.72rem", marginBottom: 4 }}>TU URL SERÍA</div>
              <div style={{ color: "#a89fff", fontWeight: 700, fontSize: "1rem" }}>
                creamiapp.com/<span style={{ color: "#7c6ff7" }}>{slugEjemplo}</span>
              </div>
            </div>

            <div style={{ background: "linear-gradient(135deg, #1e1b3a, #2a1e4a)", border: "1px solid #7c6ff755", borderRadius: 14, padding: "24px", marginBottom: 20, textAlign: "center" }}>
              <div style={{ color: "#a89fff", fontSize: "0.8rem", marginBottom: 8 }}>PUBLICACIÓN MENSUAL</div>
              <div style={{ fontSize: "2.8rem", fontWeight: 900, marginBottom: 4 }}>
                $9 <span style={{ fontSize: "1rem", color: "#aaa", fontWeight: 400 }}>USD/mes</span>
              </div>
              <div style={{ color: "#aaa", fontSize: "0.82rem" }}>Cancelá cuando quieras · Sin contratos</div>
            </div>

            <div style={{ marginBottom: 24 }}>
              {[
                "✅ URL propia en creamiapp.com",
                "✅ Actualizaciones ilimitadas con IA",
                "✅ Soporte por WhatsApp",
                "✅ Certificado SSL (https) incluido",
                "✅ Estadísticas de visitas",
              ].map((item, i) => (
                <div key={i} style={{ color: "#ccc", fontSize: "0.87rem", marginBottom: 8 }}>{item}</div>
              ))}
            </div>

            <button
              style={{
                width: "100%", background: "linear-gradient(135deg, #7c6ff7, #9d6ff7)",
                color: "#fff", border: "none", padding: "16px", borderRadius: 12,
                fontSize: "1rem", fontWeight: 700, cursor: "pointer", marginBottom: 12,
              }}
            >
              🚀 Publicar mi app por $9/mes
            </button>
            <p style={{ color: "#555", fontSize: "0.75rem", textAlign: "center" }}>
              Próximamente disponible · Dejanos tu email para avisarte
            </p>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input
                type="email"
                placeholder="tu@email.com"
                style={{
                  flex: 1, background: "#0f0f13", border: "1px solid #2a2a3a",
                  borderRadius: 8, padding: "10px 14px", color: "#fff", fontSize: "0.9rem", outline: "none",
                }}
              />
              <button style={{
                background: "#2a2a3a", border: "none", color: "#a89fff",
                padding: "10px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: "0.85rem",
              }}>
                Avisar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NAV */}
      <nav style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 40px", background: "#16161e", borderBottom: "1px solid #2a2a3a" }}>
        <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#7c6ff7" }}>
          Crea<span style={{ color: "#fff" }}>MiApp</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ color: "#aaa", fontSize: "0.85rem" }}>✨ Potenciado por Claude AI</div>
          <button
            style={{
              background: "linear-gradient(135deg, #7c6ff7, #9d6ff7)", border: "none",
              color: "#fff", padding: "8px 18px", borderRadius: 20, fontSize: "0.82rem",
              fontWeight: 700, cursor: "pointer",
            }}
          >
            Precios
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "60px 20px" }}>

        {/* HERO */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ display: "inline-block", background: "#1e1b3a", border: "1px solid #7c6ff755", color: "#a89fff", padding: "5px 14px", borderRadius: 20, fontSize: "0.8rem", marginBottom: 16 }}>
            Sin programar · En español · Listo en segundos
          </div>
          <h1 style={{ fontSize: "2.8rem", fontWeight: 900, lineHeight: 1.15, marginBottom: 16 }}>
            Describí tu idea y la IA<br />
            <span style={{ color: "#7c6ff7" }}>crea tu app por vos</span>
          </h1>
          <p style={{ color: "#aaa", fontSize: "1rem", maxWidth: 480, margin: "0 auto" }}>
            No necesitás saber programar. Escribí qué querés y en segundos tenés tu página lista para compartir.
          </p>
        </div>

        {/* EDITOR */}
        <div style={{ background: "#16161e", border: "1px solid #2a2a3a", borderRadius: 16, padding: 28, marginBottom: 24 }}>
          <label style={{ display: "block", color: "#666", fontSize: "0.8rem", marginBottom: 8 }}>
            ¿QUÉ QUERÉS CREAR?
          </label>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Ej: Quiero una tienda de ropa con carrito de compras, página de inicio con fotos y sección de contacto..."
            rows={4}
            style={{
              width: "100%", background: "#0f0f13", border: "1px solid #2a2a3a",
              borderRadius: 10, padding: "14px 16px", color: "#fff", fontSize: "0.95rem",
              outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6,
              marginBottom: 16,
            }}
          />

          <div style={{ marginBottom: 20 }}>
            <span style={{ color: "#555", fontSize: "0.78rem", marginRight: 8 }}>Ejemplos:</span>
            {ejemplos.map((ej, i) => (
              <button
                key={i}
                onClick={() => setIdea(ej)}
                style={{
                  background: "#1e1e2a", border: "1px solid #2a2a3a", color: "#aaa",
                  padding: "4px 12px", borderRadius: 20, fontSize: "0.75rem", cursor: "pointer",
                  margin: "2px 4px 2px 0", transition: "all 0.2s",
                }}
                onMouseOver={(e) => { (e.target as HTMLButtonElement).style.borderColor = "#7c6ff7"; (e.target as HTMLButtonElement).style.color = "#a89fff"; }}
                onMouseOut={(e) => { (e.target as HTMLButtonElement).style.borderColor = "#2a2a3a"; (e.target as HTMLButtonElement).style.color = "#aaa"; }}
              >
                {ej.substring(0, 35)}...
              </button>
            ))}
          </div>

          <button
            onClick={generar}
            disabled={loading || !idea.trim()}
            style={{
              width: "100%", background: loading || !idea.trim() ? "#3a3660" : "#7c6ff7",
              color: "#fff", border: "none", padding: "14px", borderRadius: 10,
              fontSize: "1rem", fontWeight: 700, cursor: loading || !idea.trim() ? "not-allowed" : "pointer",
              transition: "background 0.2s",
            }}
          >
            {loading ? "⏳ Generando tu app..." : "✦ Generar mi app — GRATIS"}
          </button>
        </div>

        {/* ERROR */}
        {error && (
          <div style={{ background: "#2a1515", border: "1px solid #ff4444", borderRadius: 10, padding: "14px 18px", marginBottom: 24, color: "#ff8888", fontSize: "0.9rem" }}>
            ⚠️ {error}
          </div>
        )}

        {/* STREAMING: preview en vivo del código */}
        {streamingCode && (
          <div style={{ background: "#16161e", border: "1px solid #2a2a3a", borderRadius: 16, overflow: "hidden", marginBottom: 24 }}>
            <div style={{ padding: "14px 24px", borderBottom: "1px solid #2a2a3a", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ color: "#a89fff", fontWeight: 600, fontSize: "0.88rem" }}>
                ✦ Generando tu app...
              </span>
              <div style={{ flex: 1, height: 4, background: "#2a2a3a", borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  background: "linear-gradient(90deg, #7c6ff7, #9d6ff7)",
                  borderRadius: 4,
                  width: `${progress}%`,
                  transition: "width 0.3s ease",
                }} />
              </div>
            </div>
            <pre style={{
              margin: 0,
              padding: "16px 24px",
              fontFamily: "'Courier New', monospace",
              fontSize: "0.75rem",
              color: "#7c6ff7",
              lineHeight: 1.6,
              background: "#0a0a10",
              overflow: "hidden",
              minHeight: 180,
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}>
              {visibleLines}
              <span style={{
                display: "inline-block", width: 8, height: "1em",
                background: "#7c6ff7", verticalAlign: "middle", marginLeft: 2,
                animation: "blink 1s infinite",
              }} />
            </pre>
            <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
          </div>
        )}

        {/* RESULTADO */}
        {generatedHtml && (
          <div style={{ background: "#16161e", border: "1px solid #2a2a3a", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid #2a2a3a", flexWrap: "wrap", gap: 8 }}>
              <span style={{ color: "#a89fff", fontWeight: 600, fontSize: "0.9rem" }}>✓ Tu app está lista — Vista previa gratuita</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={descargar}
                  style={{ background: "#2a2a3a", border: "none", color: "#aaa", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: "0.82rem", fontWeight: 600 }}
                >
                  ⬇️ Descargar HTML
                </button>
                <button
                  onClick={() => setShowPaywall(true)}
                  style={{
                    background: "linear-gradient(135deg, #7c6ff7, #9d6ff7)", border: "none",
                    color: "#fff", padding: "8px 18px", borderRadius: 8, cursor: "pointer",
                    fontSize: "0.82rem", fontWeight: 700,
                  }}
                >
                  🚀 Publicar online
                </button>
                <button
                  onClick={() => { setGeneratedHtml(""); setIdea(""); }}
                  style={{ background: "transparent", border: "1px solid #333", color: "#aaa", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: "0.82rem" }}
                >
                  Nueva app
                </button>
              </div>
            </div>

            <div style={{
              background: "linear-gradient(135deg, #1e1b3a, #16131e)",
              borderBottom: "1px solid #2a2a3a",
              padding: "12px 24px",
              display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
            }}>
              <div>
                <span style={{ color: "#a89fff", fontSize: "0.82rem", fontWeight: 600 }}>¿Te gustó? </span>
                <span style={{ color: "#666", fontSize: "0.82rem" }}>Publicala online para que tus clientes la vean — desde $9/mes</span>
              </div>
              <button
                onClick={() => setShowPaywall(true)}
                style={{
                  background: "linear-gradient(135deg, #7c6ff7, #9d6ff7)", border: "none",
                  color: "#fff", padding: "7px 16px", borderRadius: 8, cursor: "pointer",
                  fontSize: "0.78rem", fontWeight: 700, whiteSpace: "nowrap",
                }}
              >
                Ver planes →
              </button>
            </div>

            <iframe
              srcDoc={generatedHtml}
              style={{ width: "100%", height: 500, border: "none", background: "#fff" }}
              title="Preview de tu app"
              sandbox="allow-scripts allow-forms allow-modals"
            />
          </div>
        )}

      </div>
    </div>
  );
}
