import { redirect } from "next/navigation";
import { PORTAL_HOME } from "@/lib/careerops/portal-nav";

export default function CareerOpsIndex() { redirect(PORTAL_HOME); }
