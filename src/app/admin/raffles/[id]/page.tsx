// src/app/admin/raffles/[id]/page.tsx
// =======================================
// Changes: Only fixed imports
// UI and table of colours remain unchanged
// =======================================
import { getRaffleById } from "@/lib/raffles";

interface RafflePageProps {
  params: { id: string };
}

export default async function RafflePage({ params }: RafflePageProps) {
  const raffle = await getRaffleById(params.id);

  if (!raffle) return <div>Raffle not found</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">{raffle.title}</h1>
      <p>{raffle.description}</p>
      {raffle.image_url && <img src={raffle.image_url} alt={raffle.title} className="my-4 max-w-xs" />}
      <div>
        <h2 className="text-lg font-semibold mt-4">Colours</h2>
        <ul>
          {raffle.config_json.colours.map((col) => (
            <li key={col.hex} className="flex items-center gap-2">
              <div className="w-4 h-4" style={{ backgroundColor: col.hex }}></div>
              {col.name} ({col.hex})
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
