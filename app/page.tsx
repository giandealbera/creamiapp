"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const IFRAME_GUARD = `<base target="_blank"><script>(function(){document.addEventListener('click',function(e){var el=e.target;while(el&&el.tagName!=='A')el=el.parentElement;if(el&&el.tagName==='A'){var h=el.getAttribute('href')||'';if(h&&!h.startsWith('#')&&!h.startsWith('http')&&!h.startsWith('mailto')&&!h.startsWith('tel')){e.preventDefault();}}},true);})();<\/script>`;

const MAX_IDEA_LENGTH = 2000;
const TIMEOUT_MS = 600_000; // 10 minutos — Edge runtime no tiene límite de servidor

type Device = "mobile" | "tablet" | "desktop";
const DEVICE_WIDTHS: Record<Device, string> = {
  mobile: "375px",
  tablet: "768px",
  desktop: "100%",
};

export default function Home() {
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [streamingCode, setStreamingCode] = useState("");
  const [error, setError] = useState("");
  const [showPaywall, setShowPaywall] = useState(false);
  const [device, setDevice] = useState<Device>("desktop");
  const [iframeHeight, setIframeHeight] = useState(520);
  const [copied, setCopied] = useState(false);
  const [paywallEmail, setPaywallEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds since generation started
  const abortRef = useRef<AbortController | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start/stop elapsed timer with loading state
  useEffect(() => {
    if (loading) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loading]);

  const ejemplos = [
    "Una tienda de ropa con carrito de compras y sección de contacto",
    "Un portfolio personal para fotógrafo con galería de fotos",
    "Una página para un restaurante con menú y reservas",
    "Una landing page para una app de delivery de comida",
  ];

  const generar = useCallback(async () => {
    if (!idea.trim() || loading) return;

    // Create a fresh controller for this request
    const controller = new AbortController();
    abortRef.current = controller;
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, TIMEOUT_MS);

    setLoading(true);
    setError("");
    setGeneratedHtml("");
    setStreamingCode("");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        const msg = (data as { error?: string }).error || "Hubo un problema. Intentá de nuevo.";
        setError(msg);
        setTimeout(() => errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        accumulated += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        if (done) break;
        setStreamingCode(accumulated);
      }

      if (!accumulated.trim()) {
        setError("La IA no generó contenido. Intentá con una descripción más detallada.");
        return;
      }

      // Clean markdown code fences if present
      const cleanHtml = accumulated
        .replace(/^```html\n?/, "")
        .replace(/\n?```$/, "")
        .trim();

      // Inject iframe navigation guard
      const fixedHtml = cleanHtml.replace(/<head([^>]*)>/i, `<head$1>${IFRAME_GUARD}`);

      setStreamingCode("");
      setGeneratedHtml(fixedHtml);
    } catch (err) {
      setStreamingCode("");
      const isAbort = (err as Error).name === "AbortError";
      if (isAbort && timedOut) {
        setError("La generación tardó demasiado. Intentá con una descripción más corta.");
      } else if (isAbort) {
        // User clicked Cancel — don't show an error
      } else {
        setError("Hubo un problema de conexión. Intentá de nuevo.");
      }
      setTimeout(() => errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [idea, loading]);

  function cancelar() {
    abortRef.current?.abort();
    setLoading(false);
    setStreamingCode("");
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

  async function copiarHtml() {
    await navigator.clipboard.writeText(generatedHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleIframeLoad(e: React.SyntheticEvent<HTMLIFrameElement>) {
    try {
      const doc = (e.target as HTMLIFrameElement).contentWindow?.document;
      if (doc) {
        const h = doc.documentElement.scrollHeight;
        setIframeHeight(Math.min(Math.max(h, 400), 1600));
      }
    } catch {
      // cross-origin, keep default height
    }
  }

  async function notificarEmail() {
    if (!paywallEmail || !paywallEmail.includes("@")) return;
    // TODO: connect to actual waitlist API
    setEmailSent(true);
    setPaywallEmail("");
  }

  const slugEjemplo =
    idea.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().split(/\s+/).slice(0, 2).join("-") || "mi-app";

  const remaining = MAX_IDEA_LENGTH - idea.length;
  const progress = Math.min((streamingCode.length / 4000) * 100, 95);
  const visibleLines = streamingCode.split("\n").slice(-12).join("\n");

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f13", color: "#fff", fontFamily: "'Segoe UI', sans-serif" }}>

      {/* MODAL PAYWALL */}
      {showPaywall && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="paywall-title"
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
              type="button"
              onClick={() => setShowPaywall(false)}
              aria-label="Cerrar"
              style={{ position: "absolute", top: 16, right: 16, background: "transparent", border: "none", color: "#555", fontSize: "1.3rem", cursor: "pointer" }}
            >✕</button>

            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🚀</div>
              <h2 id="paywall-title" style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: 8 }}>
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
              {["✅ URL propia en creamiapp.com", "✅ Actualizaciones ilimitadas con IA", "✅ Soporte por WhatsApp", "✅ Certificado SSL (https) incluido", "✅ Estadísticas de visitas"].map((item, i) => (
                <div key={i} style={{ color: "#ccc", fontSize: "0.87rem", marginBottom: 8 }}>{item}</div>
              ))}
            </div>

            <button
              type="button"
              disabled
              style={{
                width: "100%", background: "linear-gradient(135deg, #7c6ff7, #9d6ff7)",
                color: "#fff", border: "none", padding: "16px", borderRadius: 12,
                fontSize: "1rem", fontWeight: 700, cursor: "not-allowed", marginBottom: 8, opacity: 0.85,
              }}
            >
              🚀 Publicar mi app por $9/mes
            </button>
            <p style={{ color: "#555", fontSize: "0.75rem", textAlign: "center", marginBottom: 12 }}>
              Próximamente disponible · Anotate y te avisamos
            </p>

            {emailSent ? (
              <div style={{ textAlign: "center", color: "#a89fff", fontSize: "0.9rem", padding: "10px" }}>
                ✅ ¡Listo! Te avisamos cuando esté disponible.
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="email"
                  placeholder="tu@email.com"
                  value={paywallEmail}
                  onChange={(e) => setPaywallEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && notificarEmail()}
                  style={{
                    flex: 1, background: "#0f0f13", border: "1px solid #2a2a3a",
                    borderRadius: 8, padding: "10px 14px", color: "#fff", fontSize: "0.9rem", outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={notificarEmail}
                  style={{
                    background: "#2a2a3a", border: "none", color: "#a89fff",
                    padding: "10px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: "0.85rem",
                  }}
                >
                  Avisar
                </button>
              </div>
            )}
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
            type="button"
            onClick={() => setShowPaywall(true)}
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
          <label htmlFor="idea-input" style={{ display: "block", color: "#666", fontSize: "0.8rem", marginBottom: 8 }}>
            ¿QUÉ QUERÉS CREAR?
          </label>
          <textarea
            id="idea-input"
            value={idea}
            onChange={(e) => setIdea(e.target.value.slice(0, MAX_IDEA_LENGTH))}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) generar(); }}
            placeholder="Ej: Quiero una tienda de ropa con carrito de compras, página de inicio con fotos y sección de contacto..."
            rows={4}
            maxLength={MAX_IDEA_LENGTH}
            autoFocus
            style={{
              width: "100%", background: "#0f0f13", border: "1px solid #2a2a3a",
       
