import {NextResponse} from "next/server";

/** Legacy public route permanently disabled: all completed PDF editions
 * can only be retrieved through owner-authenticated private endpoints. */
export const dynamic="force-dynamic";
export async function GET(){
 return new NextResponse(null,{status:404,headers:{"Cache-Control":"private, no-store"}});
}
