// api/home.js — Tienda No.2 (templante2). Sirve la portada con meta tags
// Open Graph actualizados automáticamente desde Firebase (nombre, descripción y logo).
// Lee el HTML base desde templante2.html (en la raíz del proyecto).

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const STORE_NAME_DEFAULT = "DS Distribuidora San Francisco No.2";
const DESC_DEFAULT = "Distribuidora de productos al por mayor";
// Opcional: URL del logo ACTUAL, solo se usa si Firebase no responde.
const LOGO_RESPALDO =
  "https://res.cloudinary.com/dxxlersgi/image/upload/v1780665475/logodsdistribuidirasanfrancisco_cr6amy.png";
const FIREBASE_URL =
  "https://dsdistribuidorasfc2-cc78f-default-rtdb.firebaseio.com/settings.json";

let templateCache = null;
function loadTemplate() {
  if (templateCache) return templateCache;
  // Ajusta el nombre del archivo si en tu repo lo llamas distinto (ej. "template.html").
  templateCache = fs.readFileSync(path.join(process.cwd(), "templante2.html"), "utf8");
  return templateCache;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = async (req, res) => {
  const baseUrl = "https://" + req.headers.host;
  const html = loadTemplate();

  let ogTitle = STORE_NAME_DEFAULT;
  let ogDesc = DESC_DEFAULT;
  let logo = LOGO_RESPALDO;

  try {
    const fbRes = await fetch(FIREBASE_URL);
    if (fbRes.ok) {
      const settings = await fbRes.json();
      if (settings) {
        if (settings.name) ogTitle = settings.name;
        if (settings.desc) ogDesc = settings.desc;
        if (settings.logo) logo = settings.logo;
      }
    }
  } catch (err) {
    console.error("Error consultando Firebase (home):", err);
  }

  // Facebook/WhatsApp no aceptan imágenes "data:" (base64) en og:image.
  // Si el logo está guardado así, se sirve desde /api/logo con una URL
  // que cambia cada vez que cambia el logo (v = huella del contenido).
  let ogImage = "";
  if (logo.startsWith("data:")) {
    const v = crypto.createHash("md5").update(logo).digest("hex").slice(0, 10);
    ogImage = baseUrl + "/api/logo?v=" + v;
  } else if (logo) {
    ogImage = logo;
  }

  const safeTitle = escapeHtml(ogTitle);
  const safeDesc = escapeHtml(ogDesc);
  const safeImage = escapeHtml(ogImage);

  const ogBlock = `<!-- OG_META_START -->
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDesc}">
  ${ogImage ? `<meta property="og:image" content="${safeImage}">` : ""}
  <meta property="og:url" content="${baseUrl}/">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="${ogImage ? "summary_large_image" : "summary"}">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDesc}">
  ${ogImage ? `<meta name="twitter:image" content="${safeImage}">` : ""}
  <!-- OG_META_END -->`;

  // Se usa función como reemplazo para que "$" en textos no rompa el HTML.
  let finalHtml = html.replace(
    /<!-- OG_META_START -->[\s\S]*?<!-- OG_META_END -->/,
    () => ogBlock
  );

  finalHtml = finalHtml.replace(/<title>[^<]*<\/title>/, () => `<title>${safeTitle}</title>`);

  // Favicon: usa el mismo logo (reemplaza el marcador TU-URL-DEL-LOGO.png).
  if (ogImage) {
    finalHtml = finalHtml.split("https://TU-URL-DEL-LOGO.png").join(safeImage);
  } else {
    finalHtml = finalHtml.replace(/<link[^>]*TU-URL-DEL-LOGO\.png[^>]*>\s*/g, "");
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(finalHtml);
};
