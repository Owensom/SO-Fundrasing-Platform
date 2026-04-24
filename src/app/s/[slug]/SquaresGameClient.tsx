async function reserveSelected() {
  if (selected.length === 0) {
    alert("Please select at least one square.");
    return;
  }

  const response = await fetch(`/api/squares/${game.slug}/reserve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      squares: selected,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.ok) {
    alert(data.error || "Could not reserve squares.");
    return;
  }

  alert(`Reserved! Token: ${data.reservationToken}`);
}
