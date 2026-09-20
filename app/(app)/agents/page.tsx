import { redirect } from "next/navigation";
import { PORTAL_HOME } from "@/lib/careerops/portal-nav";

// The Agents tab moved into its own portal. Old bookmarks land on CareerOps → Sourcing.
export default function AgentsRedirect() { redirect(PORTAL_HOME); }
