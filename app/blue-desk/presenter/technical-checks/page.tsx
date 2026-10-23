import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import PresenterTechnicalChecks from "@/components/live-desk/PresenterTechnicalChecks";
import { isBlueDeskPublicReaderHost, isBluebellyReaderHost } from "@/lib/blue-desk-host";
import desk from "../../blue-desk.module.css";
import ui from "../v6-studio.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"Technical Checklist | Bluebelly Presenter"};
export default async function BluebellyTechnicalChecks(){
  const host=(await headers()).get("host");
  if(isBlueDeskPublicReaderHost(host)&&!isBluebellyReaderHost(host))notFound();
  return <main className={desk.page} data-bluebelly-technical-checks="private">
    <BlueDeskHeader activePath="/blue-desk/presenter"/>
    <div className={ui.content}>
      <div className={ui.privateStrip}><strong>BLUEBELLY / PRESENTER PREP / OWNER CHECKLIST</strong>
        <Link href={isBluebellyReaderHost(host)?"/presenter?view=checks":"/blue-desk/presenter?view=checks"}>← Technical overview</Link>
      </div>
      <header className={ui.studioHeader}><div className={ui.headerCopy}>
        <span className={ui.kicker}>14 MONITORS · YOUR ACCOUNT REVISION</span>
        <h1>Update technical checks.</h1>
        <p>Save dated chart readings and cite original source URLs. Your inputs remain private and non-canonical until independently verified through existing research.</p>
      </div></header>
      <div style={{marginTop:20}}><PresenterTechnicalChecks/></div>
    </div>
  </main>;
}
