// api/og.js — Tienda No.2.
// Cuando alguien comparte el enlace de un producto (/nombre-del-producto),
// sirve la tienda con la vista previa (Open Graph) de ESE producto:
// nombre, precio y foto. Si el producto no existe, usa los datos generales de la tienda.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const STORE_NAME_DEFAULT = "DS Distribuidora San Francisco No.2";
const DESC_DEFAULT = "Distribuidora de productos al por mayor";
const LOGO_RESPALDO =
  "https://res.cloudinary.com/dxxlersgi/image/upload/v1780665475/logodsdistribuidirasanfrancisco_cr6amy.png";
// Base de datos REAL de la tienda No.2 (la misma de template.html)
const DB = "https://dsdistribuidorasfc2-cc78f-default-rtdb.firebaseio.com";

let templateCache = null;
function loadTemplate() {
  if (templateCache) return templateCache;
  templateCache = fs.readFileSync(path.join(process.cwd(), "template.html"), "utf8");
  return templateCache;
}

// Debe ser IGUAL a toSlug() de template.html
function toSlug(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "-")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function getJson(url) {
  try {
    const r = await fetch(url);
    if (r.ok) return await r.json();
  } catch (err) {
    console.error("Error consultando Firebase:", err);
  }
  return null;
}

// Primera imagen utilizable del producto
function productImage(p, baseUrl, slug) {
  const candidates = [];
  if (p.imgUrl) candidates.push(p.imgUrl);
  if (Array.isArray(p.images)) candidates.push(...p.images);
  if (p.img) candidates.push(p.img);
  const url = candidates.find(u => typeof u === "string" && /^https?:\/\//i.test(u));
  if (url) return url;
  // Si la foto está guardada como "data:" (base64), Facebook/WhatsApp no la aceptan:
  // se sirve desde /api/og-image con una dirección normal.
  const hasData = candidates.some(u => typeof u === "string" && u.startsWith("data:"));
  if (hasData) return baseUrl + "/api/og-image?slug=" + encodeURIComponent(slug);
  return "";
}

module.exports = async (req, res) => {
  let slug = String(req.query.slug || "").trim();
  try { slug = decodeURIComponent(slug); } catch (e) {}
  slug = slug.toLowerCase();

  const baseUrl = "https://" + req.headers.host;

  if (!slug) {
    res.setHeader("Location", "/");
    res.status(302).end();
    return;
  }

  const [productsRaw, settings] = await Promise.all([
    getJson(DB + "/products.json"),
    getJson(DB + "/settings.json")
  ]);

  const storeName = (settings && settings.name) || STORE_NAME_DEFAULT;
  const storeDesc = (settings && settings.desc) || DESC_DEFAULT;

  const productos = productsRaw ? Object.values(productsRaw).filter(Boolean) : [];
  const producto = productos.find(p =>
    (p.slug && String(p.slug).toLowerCase() === slug) || toSlug(p.name) === slug
  );

  let ogTitle = storeName;
  let ogDesc = storeDesc;
  let ogImage = "";
  let ogType = "website";

  if (producto) {
    ogType = "product";
    const price = parseFloat(producto.price);
    const priceStr = price > 0 ? "Q" + price.toFixed(2) : "";
    ogTitle = producto.name + (priceStr ? " - " + priceStr : "");
    const desc = (producto.desc || "").trim();
    ogDesc = desc ? desc : (priceStr ? priceStr + " — " + storeName : storeName);
    ogImage = productImage(producto, baseUrl, slug);
  }

  // Si el producto no tiene foto (o no existe), usa el logo de la tienda
  if (!ogImage) {
    const logo = (settings && settings.logo) || LOGO_RESPALDO;
    if (logo.startsWith("data:")) {
      const v = crypto.createHash("md5").update(logo).digest("hex").slice(0, 10);
      ogImage = baseUrl + "/api/logo?v=" + v;
    } else {
      ogImage = logo;
    }
  }

  const t = escapeHtml(ogTitle);
  const d = escapeHtml(ogDesc.slice(0, 300));
  const img = escapeHtml(ogImage);
  const url = escapeHtml(baseUrl + "/" + encodeURIComponent(slug));

  const ogBlock = `<!-- OG_META_START -->
  <meta property="og:title" content="${t}">
  <meta property="og:description" content="${d}">
  <meta property="og:image" content="${img}">
  <meta property="og:url" content="${url}">
  <meta property="og:site_name" content="${escapeHtml(storeName)}">
  <meta property="og:type" content="${ogType}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${t}">
  <meta name="twitter:description" content="${d}">
  <meta name="twitter:image" content="${img}">
  <!-- OG_META_END -->`;

  let finalHtml = loadTemplate().replace(
    /<!-- OG_META_START -->[\s\S]*?<!-- OG_META_END -->/,
    () => ogBlock
  );
  finalHtml = finalHtml.replace(/<title>[^<]*<\/title>/, () => `<title>${t}</title>`);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  res.status(200).send(finalHtml);
};
