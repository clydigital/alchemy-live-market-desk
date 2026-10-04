export type StoryPublicationPointer = {
  id: string;
  current_thesis_version_id?: string | null;
};

export type StoryPublicationVersion = {
  id: string;
  story_id: string;
  version_number: number;
  effective_at: string;
};

export function newestPublicationVersionByStory<T extends StoryPublicationVersion>(versions: T[]) {
  const result = new Map<string, T>();
  for (const version of versions) {
    const current = result.get(version.story_id);
    if (
      !current
      || version.version_number > current.version_number
      || (
        version.version_number === current.version_number
        && version.effective_at > current.effective_at
      )
    ) {
      result.set(version.story_id, version);
    }
  }
  return result;
}

export function publicationVersionById<T extends StoryPublicationVersion>(versions: T[]) {
  return new Map(versions.map((version) => [version.id, version] as const));
}

export function authoritativePublicationVersionForStory<
  TStory extends StoryPublicationPointer,
  TVersion extends StoryPublicationVersion,
>(
  story: TStory,
  byId: ReadonlyMap<string, TVersion>,
  newestByStory: ReadonlyMap<string, TVersion>,
) {
  const pointer = story.current_thesis_version_id?.trim() || "";
  return pointer ? byId.get(pointer) : newestByStory.get(story.id);
}
