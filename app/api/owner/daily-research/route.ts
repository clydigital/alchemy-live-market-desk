import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { blueDeskHostAccess } from "@/lib/blue-desk-host";
import { fetchTodayNotionResearch } from "@/lib/notion-market-research";
import { buildDailyResearchPacket } from "@/lib/daily-report-research-packet";
import { assessDailyResearchHealth } from "@/lib/daily-report-research-health";
import { getCurrentVerifiedMarketMotion } from "@/lib/market-motion";
import { selectVerifiedNewsBriefs } from "@/lib/market-brief-news";
import { getOriginalPressNews } from "@/lib/blue-desk-original-press-news-server";
import { combineQualifiedNews } from "@/lib/blue-desk-qualified-news";
import { getEconomicCalendar } from "@/lib/calendar";
import { getForwardEarningsEvents } from "@/lib/forward-earnings-sources";
import { buildPresenterCalendar } from "@/lib/presenter-calendar";
import { selectBlueDeskUpcoming } from "@/lib/blue-desk-calendar";
import { getMarketMonitor } from "@/lib/market-monitor-public";
import {getOwnerDeliveredResearchBriefs} from "@/lib/blue-desk-delivered-research-server";
import {getPrivateReviewedCreatorArguments} from "@/lib/bluebelly-private-creator-reviews";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=60;
const noStore={"Cache-Control":"private, no-store"};
function fail(code:number,msg:string){return NextResponse.json({error:msg},{status:code,headers:noStore});}

export async function GET(req:NextRequest){
  const host=req.headers.get("host")||req.nextUrl.hostname;
  if(blueDeskHostAccess("/api/owner/daily-research",host)!=="private")return fail(404,"Not found");
  const session=await createSupabaseServerClient().catch(()=>null);
  if(!session)return fail(503,"Owner authentication unavailable");
  const {data:{user},error:identityError}=await session.auth.getUser();
  if(identityError||!user?.email)return fail(401,"Owner sign-in required");
  const {data:access,error:accessError}=await session.from("app_access_allowlist")
    .select("email").eq("email",user.email.toLowerCase().trim())
    .eq("active",true).maybeSingle();
  if(accessError||!access)return fail(403,"Owner account not authorised");

  const now=new Date();
  const [notion,rawNews,originalPress,monitor,macro,earnings,delivery,creatorDelivery]=await Promise.all([
    fetchTodayNotionResearch(now),
    getCurrentVerifiedMarketMotion({limit:24}).catch(()=>[]),
    getOriginalPressNews(now,12).catch(()=>[]),
    getMarketMonitor().catch(()=>null),
    getEconomicCalendar().catch(()=>[]),
    getForwardEarningsEvents({now}).catch(()=>({
      events:[],coverage:"unavailable" as const,warning:"Earnings source unavailable",
    })),
    getOwnerDeliveredResearchBriefs(6)
      .then(briefs=>({status:"AVAILABLE" as const,briefs}))
      .catch(()=>({status:"UNAVAILABLE" as const,briefs:[]})),
    getPrivateReviewedCreatorArguments(now)
      .then(reviews=>({status:"AVAILABLE" as const,reviews}))
      .catch(()=>({status:"UNAVAILABLE" as const,reviews:[]})),
  ]);
  const motionNews=selectVerifiedNewsBriefs(rawNews,now,12);
  const news=combineQualifiedNews(motionNews,originalPress,12);
  const calendar=buildPresenterCalendar(macro,earnings,now);
  const upcoming=selectBlueDeskUpcoming(calendar,now,30).slice(0,14);
  const packet=buildDailyResearchPacket({
    now:now.toISOString(),notion,news,
    editorialBriefs:delivery.briefs,
    creatorReviews:creatorDelivery.reviews,
    creatorCoverageStatus:creatorDelivery.status,
    prices:(monitor?.rows||[]).filter(r=>r.last!==null)
      .slice(0,12).map(r=>({
        label:r.label,level:r.last,asOf:r.asOf,
        sourceName:r.sourceName,frequency:r.frequency,
      })),
    calendar:upcoming.map(e=>({
      title:e.title,scheduledAt:e.scheduledAt||e.localDate||null,
      sourceName:e.sourceName,sourceUrl:e.sourceUrl||null,
      verificationState:e.verificationState,decidingQuestion:e.decidingQuestion,
    })),
  });
  const health=assessDailyResearchHealth({now,notion,packet,news});
  return NextResponse.json({
    ...packet,health,
    creatorReviewCoverage:{status:creatorDelivery.status,count:creatorDelivery.reviews.length,
      caveat:"Reviews have original video dates and attributed mechanisms; their claims have not been independently source-verified."},
    deliveredResearch:{status:delivery.status,count:delivery.briefs.length,
      caveat:"Delivered editorial briefs are unverified research, not a substitute for full Notion or Research Gap source reads."},
    sourcePages:notion.sources.map(s=>({
      kind:s.kind,title:s.title,url:s.url,retrievedAt:s.retrievedAt,
    })),
    calendarWarnings:calendar.sourceHealth.warnings,
    status:"PRIVATE_RESEARCH_INPUT_NOT_INDEPENDENTLY_VERIFIED",
  },{headers:noStore});
}