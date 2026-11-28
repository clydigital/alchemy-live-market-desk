/** Owner-directed policy: scheduled Dossier routes must never run the reasoning engine. */
export function manualOnlyDossierResponse(authorised:boolean,scheduleEnabled:boolean):Response {
 const headers={"Cache-Control":"private, no-store"};
 if(!authorised)return Response.json({status:"unauthorized"},{status:401,headers});
 if(!scheduleEnabled)return Response.json({status:"disabled"},{headers});
 return Response.json({status:"not_required",mode:"MANUAL_ONLY",reason:"Dossier is owner-requested reference material"},{headers});
}
