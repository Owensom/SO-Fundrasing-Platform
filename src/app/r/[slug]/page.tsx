import * as PublicRafflePageModule from "@/components/PublicRafflePage";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

type PublicRafflePageProps = {
  slug: string;
};

const PublicRafflePage = (
  PublicRafflePageModule as unknown as {
    default?: (props: PublicRafflePageProps) => JSX.Element;
    PublicRafflePage?: (props: PublicRafflePageProps) => JSX.Element;
  }
).default ?? (
  PublicRafflePageModule as unknown as {
    default?: (props: PublicRafflePageProps) => JSX.Element;
    PublicRafflePage?: (props: PublicRafflePageProps) => JSX.Element;
  }
).PublicRafflePage;

export default async function RaffleSlugPage({ params }: PageProps) {
  const { slug } = await params;

  if (!PublicRafflePage) {
    throw new Error(
      "PublicRafflePage component was not exported from src/components/PublicRafflePage.tsx.",
    );
  }

  return <PublicRafflePage slug={slug} />;
}
