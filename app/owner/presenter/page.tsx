import { redirect } from "next/navigation";

// Presenter preparation is retired. Preserve this old signed-in URL only as
// a compatibility redirect; research, source storage and scheduled writing
// remain independently available in the private My Desk library.
export const dynamic="force-dynamic";
export const metadata={title:"My Desk | Bluebelly",robots:{index:false,follow:false}};
export default function RetiredPresenterPreparation(){
  redirect("/my-reports");
}
