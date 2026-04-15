useEffect(() => {
  let active = true;

  async function load() {
    try {
      setLoading(true);
      setError("");
      const data = await getPublicRaffleBySlug(slug);
      if (!active) return;
      setRaffle(data);
    } catch (err) {
      if (!active) return;
      setError(err instanceof Error ? err.message : "Failed to load raffle");
    } finally {
      if (active) setLoading(false);
    }
  }

  if (slug) {
    load();
  }

  return () => {
    active = false;
  };
}, [slug]);
