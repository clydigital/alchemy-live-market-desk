import Link from "next/link";
import PresenterLabChecks from "@/components/blue-desk/PresenterLabChecks";
import EditorialWorkbench from "@/components/blue-desk/EditorialWorkbench";
import { LAB_SLATE,LAB_PRICE_CARDS } from "@/lib/editorial-lab-fixtures";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import desk from "../blue-desk.module.css";
import ui from "./editorial-lab.module.css";

export const metadata={
 title:"Temporary Editorial Lab — No Login | Bluebelly",
 description:"Synthetic-only, auth-free UI testing of COTD, OB and Impact research flows.",
};
type Props={searchParams:Promise<{view?:string|string[]}>};
export default async function EditorialLab({searchParams}:Props){
 const params=await searchParams;
 const presenter=params.view==="presenter";
 return <main className={desk.page} data-no-login-editorial-lab="synthetic-only">
   <BlueDeskHeader activePath="/blue-desk/editorial-lab"/>
   <div className={desk.content}>
    <section className={ui.banner} role="note">
      <p className={ui.kicker}>TEMPORARY DEVELOPMENT LAB · NO GOOGLE LOGIN</p>
      <h1>{presenter?"Presenter Studio — UI preview":"Editorial Studio — UI preview"}</h1>
      <p>Use the existing Bluebelly Studio layout without a Google login. Start with a synthetic
       example, or paste research produced in ChatGPT using your connected sources.
       Imported material remains <strong>unverified external research</strong>.
       Market monitoring and model-generation actions remain offline examples:
       they cannot access Gemini, original market feeds, private saved slates,
       owner APIs, canonical Evidence or publication. No imported notes are
       sent to a Bluebelly server.</p>
      <p><Link href="/editorial-lab?view=editorial">Editorial preview</Link>{" · "}
       <Link href="/editorial-lab?view=presenter">Presenter preview</Link>{" · "}
       <Link href="/">Public Market Desk</Link></p>
    </section>
   </div>
   {presenter?<PresenterLabChecks/>:null}
   <EditorialWorkbench mode={presenter?"presenter":"editorial"} previewMode
     priceCards={LAB_PRICE_CARDS} readError slate={LAB_SLATE} slateStatus="available"/>
   <div className={desk.content}>
     <p className={ui.note}>Temporary release aid. Before accepting a feature
      for production, independently test the real
      <code>{presenter?" /owner/presenter ":" /owner/editorial "}</code>
      under the existing approved owner login. This page is safe to remove once
      development and visual QA are complete.</p>
   </div>
 </main>;
}
