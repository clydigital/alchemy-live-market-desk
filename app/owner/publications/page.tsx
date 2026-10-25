import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import ReportPublisher from "@/components/blue-desk/ReportPublisher";
import desk from "@/app/blue-desk/blue-desk.module.css";
export const metadata={title:"Publish Reviewed Daily Report / COTD / OB | Owner Bluebelly"};
export default function OwnerPublishPage(){
 return <main className={desk.page} data-owner-reports-publisher="protected">
  <BlueDeskHeader activePath="/owner/publications"/>
  <div className={desk.content}><ReportPublisher/></div>
 </main>;
}
