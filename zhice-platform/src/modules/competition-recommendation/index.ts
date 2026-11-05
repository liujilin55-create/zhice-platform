export { CompetitionRecommendation } from "./competition-recommendation";
export { competitions, findCompetition, getAllCompetitions, getRecommendationCatalog } from "./data";
export { matchCompetitions, checkEligibility } from "./matcher";
export { getCompetitionDownload } from "./downloads";
export type { Competition, CompetitionMatch, RecommendationInput } from "./types";
export { getCompetitionSource, verifyCompetitionSource } from "./services/sources";
export type { CompetitionSourceResponse } from "./source-types";
