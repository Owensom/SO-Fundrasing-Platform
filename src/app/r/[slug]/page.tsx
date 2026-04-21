import { PublicRafflePage } from "@/components/PublicRafflePage";

type PageProps = {
  params: {
    slug: string;
  };
};

export default function RafflePage({ params }: PageProps) {
  return <PublicRafflePage slug={params.slug} />;
}
