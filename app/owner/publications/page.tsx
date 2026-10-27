import Link from "next/link";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import desk from "@/app/blue-desk/blue-desk.module.css";

export const metadata={title:"Private Reports | Blue Desk"};
export default function OwnerReportsPage(){
 return <main className={desk.page} data-owner-reports-private="no-publication">
  <BlueDeskHeader activePath="/owner/daily-report"/>
  <div className={desk.content}>
   <h1>Reports are private</h1>
   <p>Publishing is disabled. Your Daily Report, COTD and OB drafts are for your own reading, editing and copying.</p>
   <p><Link href="/owner/daily-report">Open My Daily Report</Link> · <Link href="/my-reports">Open My Desk</Link></p>
  </div>
 </main>;
}
