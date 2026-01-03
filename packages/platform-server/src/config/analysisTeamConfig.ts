/**
 * Analysis Type to Team Mapping Configuration
 * Defines how different analysis types are grouped by team
 * @module config/analysisTeamConfig
 */

// ============================================================================
// Analysis Types
// ============================================================================

/**
 * Available analysis types
 */
export enum AnalysisType {
  /** 趋势分析 - Trend Analysis */
  TREND = 'trend',
  /** 风险分析 - Risk Analysis */
  RISK = 'risk',
  /** 最终决策 - Final Decision */
  FINAL_DECISION = 'final_decision',
}

/**
 * Team identifiers
 */
export enum TeamType {
  /** 研究团队 - Research Team */
  RESEARCH = 'research',
  /** 交易决策团队 - Trading Decision Team */
  TRADING_DECISION = 'trading_decision',
}

// ============================================================================
// Team Configuration
// ============================================================================

/**
 * Team definition with display name and description
 */
export interface TeamConfig {
  /** Team identifier */
  id: TeamType;
  /** Display name (Chinese) */
  name: string;
  /** Display name (English) */
  nameEn: string;
  /** Description */
  description?: string;
}

/**
 * Analysis type definition with display name and team mapping
 */
export interface AnalysisTypeConfig {
  /** Analysis type identifier */
  id: AnalysisType;
  /** Display name (Chinese) */
  name: string;
  /** Display name (English) */
  nameEn: string;
  /** Assigned team */
  team: TeamType;
  /** Description */
  description?: string;
  /** Default flow title template */
  defaultTitle?: string;
}

// ============================================================================
// Configuration Data
// ============================================================================

/**
 * Team configurations
 */
export const TEAMS: Record<TeamType, TeamConfig> = {
  [TeamType.RESEARCH]: {
    id: TeamType.RESEARCH,
    name: '研究团队',
    nameEn: 'Research Team',
    description: '负责趋势分析和市场研究',
  },
  [TeamType.TRADING_DECISION]: {
    id: TeamType.TRADING_DECISION,
    name: '交易决策团队',
    nameEn: 'Trading Decision Team',
    description: '负责风险分析和最终交易决策',
  },
};

/**
 * Analysis type configurations with team mapping
 * 
 * Mapping rules:
 * - 趋势分析 (Trend Analysis) → 研究团队 (Research Team)
 * - 风险分析 (Risk Analysis) → 交易决策团队 (Trading Decision Team)
 * - 最终决策 (Final Decision) → 交易决策团队 (Trading Decision Team)
 */
export const ANALYSIS_TYPES: Record<AnalysisType, AnalysisTypeConfig> = {
  [AnalysisType.TREND]: {
    id: AnalysisType.TREND,
    name: '趋势分析',
    nameEn: 'Trend Analysis',
    team: TeamType.RESEARCH,
    description: '分析市场趋势和走向',
    defaultTitle: '趋势分析',
  },
  [AnalysisType.RISK]: {
    id: AnalysisType.RISK,
    name: '风险分析',
    nameEn: 'Risk Analysis',
    team: TeamType.TRADING_DECISION,
    description: '评估交易风险和潜在问题',
    defaultTitle: '风险分析',
  },
  [AnalysisType.FINAL_DECISION]: {
    id: AnalysisType.FINAL_DECISION,
    name: '最终决策',
    nameEn: 'Final Decision',
    team: TeamType.TRADING_DECISION,
    description: '综合分析后的最终交易决策',
    defaultTitle: '最终决策',
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the team for a given analysis type
 */
export function getTeamForAnalysisType(analysisType: AnalysisType): TeamType {
  const config = ANALYSIS_TYPES[analysisType];
  if (!config) {
    throw new Error(`Unknown analysis type: ${analysisType}`);
  }
  return config.team;
}

/**
 * Get the team configuration for a given analysis type
 */
export function getTeamConfigForAnalysisType(analysisType: AnalysisType): TeamConfig {
  const teamType = getTeamForAnalysisType(analysisType);
  return TEAMS[teamType];
}

/**
 * Get analysis type configuration
 */
export function getAnalysisTypeConfig(analysisType: AnalysisType): AnalysisTypeConfig {
  const config = ANALYSIS_TYPES[analysisType];
  if (!config) {
    throw new Error(`Unknown analysis type: ${analysisType}`);
  }
  return config;
}

/**
 * Get all analysis types for a given team
 */
export function getAnalysisTypesForTeam(team: TeamType): AnalysisTypeConfig[] {
  return Object.values(ANALYSIS_TYPES).filter(config => config.team === team);
}

/**
 * Get all teams
 */
export function getAllTeams(): TeamConfig[] {
  return Object.values(TEAMS);
}

/**
 * Get all analysis types
 */
export function getAllAnalysisTypes(): AnalysisTypeConfig[] {
  return Object.values(ANALYSIS_TYPES);
}

/**
 * Check if a string is a valid analysis type
 */
export function isValidAnalysisType(type: string): type is AnalysisType {
  return Object.values(AnalysisType).includes(type as AnalysisType);
}

/**
 * Check if a string is a valid team type
 */
export function isValidTeamType(type: string): type is TeamType {
  return Object.values(TeamType).includes(type as TeamType);
}

/**
 * Get group_id for a team (used for flow grouping)
 * The group_id is the same as the team type identifier
 */
export function getGroupIdForTeam(team: TeamType): string {
  return team;
}

/**
 * Get group_id for an analysis type (automatically maps to team)
 */
export function getGroupIdForAnalysisType(analysisType: AnalysisType): string {
  const team = getTeamForAnalysisType(analysisType);
  return getGroupIdForTeam(team);
}

export default {
  AnalysisType,
  TeamType,
  TEAMS,
  ANALYSIS_TYPES,
  getTeamForAnalysisType,
  getTeamConfigForAnalysisType,
  getAnalysisTypeConfig,
  getAnalysisTypesForTeam,
  getAllTeams,
  getAllAnalysisTypes,
  isValidAnalysisType,
  isValidTeamType,
  getGroupIdForTeam,
  getGroupIdForAnalysisType,
};
