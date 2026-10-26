import {NextResponse} from "next/server";

/** Personal desk policy: report drafts and PDFs are for the owner to read,
 * review, copy or export. There is deliberately no public publication API. */
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(){
  return NextResponse.json({error:"Public report publication is disabled. Your reports are private."},
    {status:410,headers:{"Cache-Control":"private, no-store"}});
}
