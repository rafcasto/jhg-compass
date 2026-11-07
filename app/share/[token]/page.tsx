import type { Metadata } from "next";
import SharedDocument, { NotShared } from "@/components/share/SharedDocument";
import { loadSharedDocument } from "@/lib/server/shares";

// /share/<token> — a JobHacking page shared read-only, as a document
// (docs/UX_SHARE.md). Public: no sign-in, no shell. Rendered on the server
// from the member's own documents through the Admin SDK — the browser gets
// the one page and the member's name, nothing else. Never indexed.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = { params: { token: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const shared = await loadSharedDocument(params.token).catch(() => null);
  const title = shared ? [shared.doc.title, shared.doc.author].filter(Boolean).join(" — ") : "Link no longer shared";
  return { title: `${title} · JobHackers Global`, robots: { index: false, follow: false } };
}

export default async function SharePage({ params }: Props) {
  const shared = await loadSharedDocument(params.token).catch(() => null);
  if (!shared) return <NotShared />;
  return <SharedDocument doc={shared.doc} sharedAt={shared.sharedAt} />;
}
