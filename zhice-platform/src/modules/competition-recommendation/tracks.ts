import type { Competition } from "./types";

const innovationCompetitionNames = new Set([
  "中国国际大学生创新大赛",
  "中国互联网+大学生创新创业大赛",
  "互联网+大学生创新创业大赛",
  "福建省互联网+大学生创新创业大赛",
  "福建省大学生创新大赛",
]);

const innovationTracks = [
  { id: "higher-education", name: "高教主赛道" },
  { id: "red-tour", name: "红旅赛道" },
  { id: "vocational", name: "职教赛道" },
  { id: "industry-challenge", name: "产业命题赛道" },
  { id: "emerging", name: "萌芽赛道" },
];

export function withInnovationTracks(
  competitionId: string,
  competitionName: string,
  existingTracks: Competition["tracks"],
): Competition["tracks"] {
  const name = competitionName.replace(/[\s“”‘’"'「」『』]/g, "").replaceAll("＋", "+");
  if (!innovationCompetitionNames.has(name)) return existingTracks;

  return innovationTracks.map((track) => {
    const existing = existingTracks.find((item) => item.name === track.name);
    // Keep real track bindings; never reuse an old placeholder's ID for a new choice.
    return existing ?? {
      trackId: `${competitionId}-${track.id}`,
      name: track.name,
      verificationStatus: "pending",
    };
  });
}
