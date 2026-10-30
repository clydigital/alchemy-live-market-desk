import "server-only";
import {createSupabaseAdminClient} from "./supabase/admin";
import {projectPublicArchive,type ArchiveNewsItem,type PublicArchiveRow}
 from "./bluebelly-publication-archive";

/**
 * Public-safe, bounded read projection from a private backend ARCHIVE.
 * This lookup has no write effect. Only previously reviewed, explicitly
 * allowlisted public-reader metadata may leave the server.
 * The archive itself has no anonymous/browser SELECT grants.
 */
export async function getRecentArchivedPublicReaderItems(now=new Date()):Promise<ArchiveNewsItem[]>{
 if(!Number.isFinite(+now))return [];
 const cutoff=new Date(+now-7*86400000);
 const db=createSupabaseAdminClient();
 const {data,error}=await db.from("bluebelly_publication_archive")
  .select("record_key,event_type,headline,event_at,event_day,source_url,source_name,reader_href,source_module,topics,entity_keys,publication_basis,approved_publication_id")
  .or("event_at.gte."+cutoff.toISOString()+",event_day.gte."+cutoff.toISOString().slice(0,10))
  .limit(200);
 if(error)throw new Error("Public archive metadata unavailable");
 return projectPublicArchive((data||[]) as PublicArchiveRow[],now);
}
