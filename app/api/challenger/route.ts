import { NextResponse } from "next/server";

import { getChallengerSnapshot } from "@/lib/challenger";

export const revalidate = 300;

export async function GET() {
  const snapshot = await getChallengerSnapshot();
  return NextResponse.json(snapshot, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
    },
  });
}
