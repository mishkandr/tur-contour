const key='tur-contour.overview.sources';
const sections=['catalog','statistics','weather','projects'];

function read() {
  try {
    const disabled=JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(disabled) ? disabled.filter(id=>sections.includes(id)) : [];
  } catch { return []; }
}

export function sourceEnabled(id) {
  return !read().includes(id);
}

export function setSourceEnabled(id,enabled) {
  if (!sections.includes(id)) return;
  const disabled=new Set(read());
  if (enabled) disabled.delete(id);
  else disabled.add(id);
  try { localStorage.setItem(key,JSON.stringify([...disabled])); }
  catch { /* The default view remains available. */ }
}
