import type { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: "/admin/raffles",
      permanent: false,
    },
  };
};

export default function LegacyAdminCreateRaffleRedirect() {
  return null;
}
