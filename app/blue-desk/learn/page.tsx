import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import BlueDeskLearnExplorer from "@/components/blue-desk/BlueDeskLearnExplorer";
import { listConcepts } from "@/lib/concepts";
import desk from "../blue-desk.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Learn | Bluebelly Market Intelligence",
  description: "Plain-language AI, rates, bond and energy market explainers backed by Bluebelly's governed concept registry.",
};

export default function BluebellyLearnPage() {
  const concepts = listConcepts()
    .filter(c => c.status === "active")
    .map(c => ({
      key:c.key, label:c.label, definition:c.definition,
      whyItMatters:c.whyItMatters, aliases:c.aliases,
      regimes:c.regimes,
    }));
  return <main className={desk.page} data-bluebelly-learn="public-governed-concepts">
    <BlueDeskHeader activePath="/learn" />
    <BlueDeskLearnExplorer concepts={concepts} />
  </main>;
}
