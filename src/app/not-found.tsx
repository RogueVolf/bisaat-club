import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Lost your way — Bisaat Club" };

export default function NotFound() {
  return (
    <div id="lost">
      <header id="top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img id="brand" src="/brand/logo.png" alt="Bisaat Club" />
      </header>
      <main id="lostcard">
        <div id="kicker">Lost your way</div>
        <h1 id="title">This room isn&apos;t here.</h1>
        <div id="rule" />
        <p id="body">The page you followed doesn&apos;t exist. The rest of the club does.</p>
        <Link id="book" href="/">Back to the floor</Link>
      </main>
    </div>
  );
}
