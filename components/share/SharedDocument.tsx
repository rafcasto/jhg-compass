import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { shareDate, type ShareBlock, type ShareDocument as Doc, type ShareEntry } from "@/lib/jobhacking/share";

// The shared page as a document — docs/UX_SHARE.md (decision 2026-11-07).
//
// Not the app: no shell, no rail, no cards, no buttons, no state glyphs. A
// title, the author line, every section as a heading with its content
// flowing under it, on the paper itself — the way a page someone exported to
// share reads. One column at prose width, left-aligned; hierarchy by size and
// weight only (h1 → author line → h2 per section → labels that recede → the
// values); ink and mute and nothing else. The only links are the ones the
// member's own data carries. Prints as a document (`.share-doc` in
// globals.css). Pure: renders on the server from the document model.

export default function SharedDocument({ doc, sharedAt }: { doc: Doc; sharedAt: number }) {
  return (
    <Frame>
      <header className="space-y-2">
        <h1>{doc.title}</h1>
        <p className="text-sm text-jh-mute">{[doc.author, `shared ${shareDate(sharedAt)}`].filter(Boolean).join(" · ")}</p>
      </header>

      {doc.lead && <p className="font-display text-xl font-semibold leading-relaxed text-jh-ink">{doc.lead}</p>}

      {doc.sections.length === 0 && <p className="text-jh-mute">Nothing on this page yet.</p>}

      {doc.sections.map((s) => (
        <section key={s.key} aria-labelledby={`sd-${s.key}`} className="space-y-6">
          <h2 id={`sd-${s.key}`} className="text-xl md:text-xl">{s.title}</h2>
          {s.blocks.map((b, i) => <Block key={i} b={b} />)}
        </section>
      ))}

      <footer className="share-chrome border-t border-jh-line pt-6 text-xs text-jh-mute">
        Shared read-only{doc.author ? ` by ${doc.author}` : ""} from JobHackers Global · live — what you see is the current version.
      </footer>
    </Frame>
  );
}

/** The dead-link page, in the same frame — quiet, not an error screen. */
export function NotShared() {
  return (
    <Frame>
      <header className="space-y-2">
        <h1>This link is no longer shared</h1>
        <p className="text-jh-mute">The person who shared it switched the link off. Ask them for a new one.</p>
      </header>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="share-doc mx-auto max-w-prose space-y-12 px-6 py-12 md:py-16">
      <div className="share-chrome flex items-center gap-2 text-sm text-jh-mute">
        <Image src="/assets/logo-hand.png" alt="" width={24} height={24} className="h-6 w-6" />
        <span className="font-display font-semibold">JobHackers Global</span>
      </div>
      {children}
    </main>
  );
}

function Block({ b }: { b: ShareBlock }) {
  switch (b.kind) {
    case "text":
      return (
        <div>
          {b.label && <Label>{b.label}</Label>}
          <p className="whitespace-pre-wrap leading-relaxed text-jh-body">{b.text}</p>
        </div>
      );
    case "markdown":
      return (
        <div className="prose prose-sm max-w-none text-jh-body prose-headings:font-display prose-headings:text-jh-ink prose-a:text-jh-ink">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{b.text}</ReactMarkdown>
        </div>
      );
    case "facts":
      return (
        <div>
          {b.label && <Label>{b.label}</Label>}
          <Facts facts={b.facts} />
        </div>
      );
    case "list":
      return (
        <div>
          {b.label && <Label>{b.label}</Label>}
          <ul className="list-disc space-y-1 pl-5 leading-relaxed text-jh-body">{b.items.map((x, i) => <li key={`${i}-${x}`}>{x}</li>)}</ul>
        </div>
      );
    case "entries":
      return (
        <div>
          {b.label && <Label>{b.label}</Label>}
          <ol className="divide-y divide-jh-line border-t border-jh-line">{b.entries.map((e, i) => <Entry key={`${i}-${e.title}`} e={e} />)}</ol>
        </div>
      );
  }
}

/** A block's label recedes: 13px, medium, mute — the value under it leads. */
const Label = ({ children }: { children: React.ReactNode }) => <p className="label">{children}</p>;

function Facts({ facts }: { facts: readonly { label: string; value: string; url?: string }[] }) {
  if (!facts.length) return null;
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
      {facts.map((f) => (
        <div key={f.label} className="contents">
          <dt className="text-jh-mute">{f.label}</dt>
          <dd className="whitespace-pre-wrap text-jh-body">{f.url ? <A href={f.url}>{f.value}</A> : f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Entry({ e, nested = false }: { e: ShareEntry; nested?: boolean }) {
  const title = e.url ? <A href={e.url}>{e.title}</A> : e.title;
  return (
    <li className={`space-y-1 ${nested ? "py-2" : "py-3"}`}>
      <p className={`font-display font-semibold text-jh-ink ${nested ? "text-sm" : "text-[15px]"}`}>
        {e.index && <span className="mr-2 font-mono text-xs font-normal tabular-nums text-jh-mute">{e.index}</span>}
        {title}
        {!!e.tags?.length && <span className="ml-2 font-body text-sm font-normal text-jh-mute">{e.tags.join(" · ")}</span>}
      </p>
      {e.meta && <p className="text-sm text-jh-mute">{e.meta}</p>}
      {e.text && <p className="whitespace-pre-wrap text-sm leading-relaxed text-jh-body">{e.text}</p>}
      {!!e.facts?.length && <Facts facts={e.facts} />}
      {!!e.children?.length && (
        <ul className="mt-2 border-l border-jh-line pl-4">{e.children.map((c, i) => <Entry key={`${i}-${c.title}`} e={c} nested />)}</ul>
      )}
    </li>
  );
}

/** A link in a document: ink, underlined — never red, never a button. */
const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noreferrer" className="underline decoration-jh-line-2 underline-offset-2 hover:decoration-jh-ink">{children}</a>
);
