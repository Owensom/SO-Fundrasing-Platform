import { getRaffleById } from "@/lib/raffles";
import AdminRaffleEditor from "./AdminRaffleEditor";

interface RafflePageProps {
  params: { id: string };
}

export default async function RafflePage({ params }: RafflePageProps) {
  const raffle = await getRaffleById(params.id);

  if (!raffle) {
    return <div className="p-6">Raffle not found</div>;
  }

  return <AdminRaffleEditor raffle={raffle} />;
}
