const paths = ["/", "/pages/legal/aviso-legal.html", "/pages/legal/privacidad.html", "/pages/legal/cookies.html"];

module.exports = (req, res) => {
  const forwardedHost = req.headers["x-forwarded-host"];
  const host = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost || req.headers.host || "").split(",")[0].trim();
  const protocol = req.headers["x-forwarded-proto"] === "http" ? "http" : "https";
  if (!host || /[^a-z0-9.:-]/i.test(host)) return res.status(400).send("Host no válido");
  const origin = `${protocol}://${host}`;
  const urls = paths.map((path) => `<url><loc>${origin}${path}</loc></url>`).join("");
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
  return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
};
