export const tenants = [
  {
    id: "t1",
    name: "Demo Charity",
    slug: "demo-a",
    isActive: true,
  },
];

export const raffleEvents = [
  {
    id: "r1",
    tenantId: "t1",
    title: "Main Raffle",
    price: 2,
    startNumber: 1,
    totalTickets: 100,
    colors: ["Red", "Blue"],
    soldByColor: {
      Red: [1, 2],
      Blue: [3],
    },
  },
];
