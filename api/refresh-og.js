// api/refresh-og.js — Tienda No.2 (templante2). Le pide a Facebook que
// vuelva a leer la vista previa del enlace (equivale a "Volver a extraer"
// en el Depurador de Sharing). No lleva datos fijos de la tienda: usa
// req.headers.host, así que sirve igual para este proyecto.
// Requiere las variables de entorno FB_APP_ID y FB_APP_SECRET en Vercel
// (configúralas en el proyecto de Vercel de esta tienda No.2).

module.exports = async (req, res) => {
  const appId = process.env.FB_APP_ID;
  const appSecret = process.env.FB_APP_SECRET;

  if (!appId || !appSecret) {
    res.status(500).json({ error: "Faltan FB_APP_ID / FB_APP_SECRET en Vercel" });
    return;
  }

  const url = "https://" + req.headers.host + "/";

  try {
    const r = await fetch("https://graph.facebook.com/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        id: url,
        scrape: "true",
        access_token: appId + "|" + appSecret
      })
    });
    const data = await r.json();
    res.setHeader("Cache-Control", "no-store");
    res.status(r.ok ? 200 : 502).json(data);
  } catch (err) {
    console.error("Error en refresh-og:", err);
    res.status(500).json({ error: String(err) });
  }
};
