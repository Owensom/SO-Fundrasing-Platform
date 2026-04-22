"use client";

type Props = {
  slug: string;
};

export default function PublicRafflePage({ slug }: Props) {
  return (
    <div style={{ padding: 24 }}>
      <h1>Public raffle component works</h1>
      <p>Slug: {slug}</p>
    </div>
  );
}
