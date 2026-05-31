import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{
    slug: string;
    entry: string;
  }>;
};

export default async function LegacyHigherOrLowerPlayLinkRedirect({
  params,
}: PageProps) {
  const { slug, entry } = await params;

  redirect(
    `/e/${encodeURIComponent(
      slug,
    )}/higher-or-lower/play?entry=${encodeURIComponent(entry)}`,
  );
}
