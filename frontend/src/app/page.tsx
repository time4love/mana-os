import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-4">Mana OS</h1>
      <Link
        href="/profile"
        className="text-primary-400 underline underline-offset-2"
      >
        פרופיל המאנה שלי
      </Link>
    </main>
  );
}
