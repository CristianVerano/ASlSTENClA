(() => {
  const canonical = document.createElement("link");
  canonical.rel = "canonical";
  canonical.href = `${window.location.origin}${window.location.pathname}`;
  document.head.append(canonical);
  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.content = canonical.href;
})();
