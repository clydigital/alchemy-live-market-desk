import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import DailyReportWriter from "@/components/blue-desk/DailyReportWriter";
import MacroPulseBriefQueue from "@/components/blue-desk/MacroPulseBriefQueue";
import desk from "@/app/blue-desk/blue-desk.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"Private Daily Report Studio | Bluebelly",
  description:"Authenticated research, verification and drafting of the daily market briefing."};
export default function OwnerDailyReportPage(){
  return <main className={desk.page} data-private-daily-report="owner-only">
    <BlueDeskHeader activePath="/owner/daily-report"/>
    <MacroPulseBriefQueue/>
    <DailyReportWriter/>
  </main>;
}
