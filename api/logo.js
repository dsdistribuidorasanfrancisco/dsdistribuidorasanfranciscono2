// api/logo.js — Tienda No.2 (templante2). Devuelve el logo guardado en
// Firebase como imagen real (por si settings.logo está en base64).
// Lo usa og:image en api/home.js.

const crypto = require("crypto");

const LOGO_URL =
  "https://dsdistribuidorasfc2-cc78f-default-rtdb.firebaseio.com/settings/logo.json";

module.exports = async (req, res) => {
  try {
    const fbRes = await fetch(LOGO_URL);
    const logo = fbRes.ok ? await fbRes.json() : null;
    const m = typeof logo === "string"
      ? /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(logo)
      : null;

    if (!m) {
      res.setHeader("Cache-Control", "no-store");
      res.status(404).end("Sin logo");
      return;
    }

    // Si piden una versión vieja (v distinta), no se cachea.
    const v = crypto.createHash("md5").update(logo).digest("hex").slice(0, 10);
    if (req.query.v && req.query.v !== v) {
      res.setHeader("Cache-Control", "no-store");
      res.status(404).end("Versión antigua");
      return;
    }

    res.setHeader("Content-Type", m[1]);
    res.setHeader("Cache-Control", "public, max-age=31536000, s-maxage=31536000, immutable");
    res.status(200).send(Buffer.from(m[2], "base64"));
  } catch (err) {
    console.error("Error en /api/logo:", err);
    res.setHeader("Cache-Control", "no-store");
    res.status(500).end("Error");
  }
};
