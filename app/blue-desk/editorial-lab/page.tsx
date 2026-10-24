import Link from "next/link";
import EditorialWorkbench from "@/components/blue-desk/EditorialWorkbench";
import { LAB_SLATE,LAB_PRICE_CARDS } from "@/lib/editorial-lab-fixtures";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import desk from "../blue-desk.module.css";
import ui from "./editorial-lab.module.css";

export const metadata={
 title:"Temporary Editorial Lab — No Login | Bluebelly",
 description:"Synthetic-only, auth-free UI testing of COTD, OB and Impact research flows.",
};
export default function EditorialLab(){
 return <main className={desk.page} data-no-login-editorial-lab="synthetic-only">
   <BlueDeskHeader activePath="/blue-desk/editorial-lab"/>
   <div className={desk.content}>
    <section className={ui.banner} role="note">
      <p className={ui.kicker}>TEMPORARY DEVELOPMENT LAB · NO GOOGLE LOGIN</p>
      <h1>Editorial Studio — UI preview</h1>
      <p>Test the article-writing layout, research modes, review states and mobile
       workflow without signing in. <strong>This is not the private research desk.</strong>
       Every market input below is synthetic. Investigation and generation actions
       run offline examples only; they cannot access Gemini, original market feeds,
       saved slates, private APIs or canonical Evidence.</p>
      <p><Link href="/">← Public Market Desk</Link></p>
    </section>
   </div>
   <EditorialWorkbench mode="editorial" previewMode
     priceCards={LAB_PRICE_CARDS} readError slate={LAB_SLATE} slateStatus="available"/>
   <div className={desk.content}>
     <p className={ui.note}>Temporary release aid. Before accepting a feature
      for production, independently test the real
      <code> /owner/editorial </code>
      under the existing approved owner login. This page is safe to remove once
      development and visual QA are complete.</p>
   </div>
 </main>;
}
