export default function handler(req: any, res: any) {
  try {
    const slug = String(req.query.slug || "");

    if (!slug) {
      return res.status(400).json({ error: "Missing slug" });
    }

    if (slug !== "demo-a") {
      return res.status(404).json({ error: "Tenant not found" });
    }

    return res.status(200).json({
      tenant: {
        id: "tenant-demo-a",
        name: "SO Fundraising Demo A",
        slug: "demo-a",
      },
      raffles: [
        {
          id: "raffle-1",
          tenantId: "tenant-demo-a",
          title: "Main Raffle",
          eventName: "Main Raffle",
          venue: "Club Hall",
          price: 2,
          startNumber: 1,
          totalTickets: 100,
          colors: ["Red", "Blue", "Green", "Yellow"],
          soldByColor: {
            Red: [1, 2, 8],
            Blue: [3, 10],
            Green: [5],
            Yellow: [],
            Purple: [],
            Orange: [],
          },
          background: "",
        },
      ],
    });
  } catch (error: any) {
    console.error("Public raffle route crashed:", error);
    return res.status(500).json({
      error: "Route crashed",
      detail: error?.message || "Unknown error",
    });
  }
}
