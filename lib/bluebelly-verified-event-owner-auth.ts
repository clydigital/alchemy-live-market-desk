/**
 * Small, injectable owner-authorization boundary for the read-only event API.
 * Supabase's auth.getUser() validates the authenticated session on the server.
 * The allowlist must then independently confirm that the email is active.
 *
 * No bearer token, owner identity or client-supplied email is accepted here.
 */
export type VerifiedEventOwnerGate =
  | {ok:true;email:string}
  | {ok:false;status:401|403|503;error:string};

type IdentityResult={
  data?:{user?:{id?:string;email?:string|null}|null}|null;
  error?:unknown;
};
type AllowedResult={data?:{email?:string|null}|null;error?:unknown};
export async function authorizeVerifiedEventOwner(input:{
  getUser:()=>Promise<IdentityResult>;
  readActiveAllowlist:(normalizedEmail:string)=>PromiseLike<AllowedResult>;
}):Promise<VerifiedEventOwnerGate>{
  let identity:IdentityResult;
  try{identity=await input.getUser();}
  catch{return {ok:false,status:503,error:"Owner authentication unavailable"};}
  const user=identity?.data?.user;
  if(identity?.error||!user||typeof user.id!=="string"||!user.id.trim()||
    typeof user.email!=="string"||!user.email.trim()){
    return {ok:false,status:401,error:"Owner sign-in required"};
  }
  const email=user.email.trim().toLowerCase();
  // This is a separate database authorization check; a verified login alone
  // never grants owner privileges. The query must filter active=true.
  let access:AllowedResult;
  try{access=await input.readActiveAllowlist(email);}
  catch{return {ok:false,status:503,error:"Owner authorisation unavailable"};}
  if(access?.error)return {ok:false,status:503,error:"Owner authorisation unavailable"};
  if(!access?.data||typeof access.data.email!=="string"||
    access.data.email.trim().toLowerCase()!==email){
    return {ok:false,status:403,error:"Owner account not authorised"};
  }
  return {ok:true,email};
}
