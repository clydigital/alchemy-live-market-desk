/** Privately delivered editorial research; never equivalent to source-verified News. */
export type DeliveredMacroPulseBrief={
 id:string;
 source_page_id:string;
 source_pulse_id:string;
 source_page_url:string;
 source_published_at:string;
 source_retrieved_at:string;
 headline:string;
 standfirst:string;
 what_changed:string;
 why_it_matters:string;
 countercase:string;
 watch_next:string;
 source_links:Array<{url:string;label:string;kind:string}>;
 status:"review"|"published";
 verification_label:"RESEARCH_DERIVED_UNADJUDICATED";
};
