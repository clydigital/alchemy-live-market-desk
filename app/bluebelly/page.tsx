import { redirect } from "next/navigation";

/** Historical preview URL; Blue Desk is the canonical presenter entry. */
export default function FormerBluebellyPreview() {
  redirect("/blue-desk");
}
