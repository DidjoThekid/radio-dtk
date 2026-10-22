  const loadDedicaces = async () => {
    const r = await fetch('/api/dedicace?admin=1', { cache: 'no-store' });
    if (!r.ok) return;
    const data = await r.json();
    const items = Array.isArray(data.items) ? data.items : [];
    setS((prev) => ({ ...prev, dedicaces: items }));
    sr.current = { ...sr.current, dedicaces: items };
  };
