import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import DailyArticleStudio from "@/components/blue-desk/DailyArticleStudio";
import desk from "@/app/blue-desk/blue-desk.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"Private Daily Articles | Bluebelly",
 description:"Owner-only daily market stories, four original article drafts and technical chart tasks."};
export default function PrivateDailyArticles(){
 return <main className={desk.page} data-private-daily-articles-page="owner-authenticated">
   <BlueDeskHeader activePath="/owner/daily-articles"/>
   <DailyArticleStudio/>
 </main>;
}
