import Head from "next/head";
import { useRouter } from "next/router";
import PublicRafflePage from "../../components/PublicRafflePage";

export default function PublicRaffleRoutePage() {
  const router = useRouter();
  const slugParam = router.query.slug;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;

  return (
    <>
      <Head>
        <title>Buy Tickets</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <PublicRafflePage slug={slug ?? ""} />
    </>
  );
}
