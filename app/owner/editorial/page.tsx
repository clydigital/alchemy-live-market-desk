import { redirect } from "next/navigation";

// Writing Desk's human-facing route is retired in favour of the private
// source-qualified My Desk library. Preserve editorial research, scheduled
// slate ingestion, APIs and immutable publications until their separate
// consumers have been audited.
export const dynamic="force-dynamic";
export const metadata={title:"My Desk | Bluebelly",robots:{index:false,follow:false}};
export default function RetiredEditorialStudio(){
  redirect("/my-reports");
}
