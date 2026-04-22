"use client";

type Props = {
  slug: string;
};

export default function PublicRafflePage({ slug }: Props) {
  return (
    <div style={{ color: "#111111" }}>
      <h1>Public component works</h1>
      <p>Slug: {slug}</p>
    </div>
  );
}
