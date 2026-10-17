// api/og-image.js — Sirve la foto de un producto guardada como "data:" (base64)
// como una imagen normal, para que Facebook y WhatsApp puedan mostrarla.
const DB = "https://dsdistribuidorasfc2-cc78f-default-rtdb.firebaseio.com";

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

module.exports = async (req, res) => {
  const slug = String(req.query.slug || "").toLowerCase().trim();
  try {
    const r = await fetch(DB + "/products.json");
    const data = r.ok ? await r.json() : null;
    const p = data && Object.values(data).filter(Boolean)
      .find(x => (x.slug && String(x.slug).toLowerCase() === slug) || toSlug(x.name) === slug);
    const candidates = p ? [p.img, ...(Array.isArray(p.images) ? p.images : [])] : [];
    const dataUrl = candidates.find(u => typeof u === "string" && u.startsWith("data:"));
    const m = dataUrl && dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) { res.status(404).send("Sin imagen"); return; }
    res.setHeader("Content-Type", m[1]);
    res.setHeader("Cache-Control", "public, s-maxage=86400");
    res.status(200).send(Buffer.from(m[2], "base64"));
  } catch (err) {
    console.error("og-image:", err);
    res.status(500).send("Error");
  }
};
