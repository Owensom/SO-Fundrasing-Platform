export const tenants = [
  {
    id: "tenant-demo-a",
    name: "SO Fundraising Demo A",
    slug: "demo-a",
    isActive: true,
  },
  {
    id: "tenant-demo-b",
    name: "SO Fundraising Demo B",
    slug: "demo-b",
    isActive: true,
  },
];

export const raffleEvents = [
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
];
