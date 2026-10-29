/** Pure, testable relevance fence for source discovery leads. Publishing a
 * headline is not scheduling an event. Do not use generic words ("summit",
 * "agreement", "partners", "AI") alone to infer tradeable catalysts.
 */
export function isMaterialCatalystHeadline(
  lane:"technology"|"diplomacy"|"fed",
  title:string,
):boolean {
  if(lane==="diplomacy") {
    return /\b(?:ceasefire|truce|peace\s+(?:deal|talks?|negotiations?|agreement|summit|framework)|humanitarian\s+corridor|hostilities|sanctions\s+relief|de.escalat(?:ion|e|es|ing)|mediat(?:ion|or|ors)|negotiat(?:ion|ions|es|ed|ing))\b/i.test(title);
  }
  // This lane is admitted only from the Fed's own speeches feed, not arbitrary news.
  // New governors and Reserve Bank speakers must not require manual name updates.
  if(lane==="fed") return title.trim().length>=3;
  const catalyst= /\b(?:GTC|keynote|unveil(?:s|ed)?|introduc(?:es|ed)|launch(?:es|ed)?|reveal(?:s|ed)?|debut(?:s|ed)?|roadshow|investor day|AI day|product event)\b/i.test(title);
  const matter= /\b(?:AI|GPU|chip|Blackwell|Rubin|inference|data.center|platform|architecture|iPhone|iPad|Mac|Watch|Vision|AirPods|Siri|robotaxi|Cybercab|FSD|autonomy|Megapack|product|device|model)\b/i.test(title);
  return catalyst && matter;
}
