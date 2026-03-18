export interface AIPromptTemplate {
  id: string
  nodeType: 'ai_analysis' | 'ai_classify' | 'ai_summarise' | 'ai_risk'
  name: string
  description: string
  prompt: string
  outputFormat?: 'json' | 'text'
  categories?: string[]
  riskCategories?: string[]
  includeOrgPolicies?: boolean
}

export const AI_PROMPT_TEMPLATES: AIPromptTemplate[] = [
  // --- AI Analysis templates ---
  {
    id: 'analysis-pipeline-risk',
    nodeType: 'ai_analysis',
    name: 'Pipeline Risk Analysis',
    description: 'Analyse pipeline health and identify at-risk deals',
    prompt: 'Analyse the current pipeline for {{block.name}}. Identify deals at risk of slipping, key blockers, and recommended actions. Consider deal stage, last activity date, and engagement signals.',
    outputFormat: 'json',
  },
  {
    id: 'analysis-client-health',
    nodeType: 'ai_analysis',
    name: 'Client Health Check',
    description: 'Assess overall client relationship health',
    prompt: 'Evaluate the health of the client relationship with {{block.name}}. Consider recent interactions, outstanding issues, contract renewal timeline, satisfaction signals, and revenue trends.',
    outputFormat: 'json',
  },
  {
    id: 'analysis-deal-qualification',
    nodeType: 'ai_analysis',
    name: 'Deal Qualification Score',
    description: 'Score and qualify a deal opportunity',
    prompt: 'Qualify the deal {{block.name}} using BANT criteria (Budget, Authority, Need, Timeline). Provide a qualification score 1-100 and identify missing information.',
    outputFormat: 'json',
  },

  // --- Classify templates ---
  {
    id: 'classify-priority-triage',
    nodeType: 'ai_classify',
    name: 'Priority Triage',
    description: 'Classify items by urgency and priority',
    prompt: 'Classify {{block.name}} by priority level based on urgency, impact, and available resources.',
    categories: ['Critical', 'High', 'Medium', 'Low'],
  },
  {
    id: 'classify-client-tier',
    nodeType: 'ai_classify',
    name: 'Client Tier Classification',
    description: 'Classify clients into service tiers',
    prompt: 'Classify the client {{block.name}} into the appropriate service tier based on revenue, engagement, strategic value, and growth potential.',
    categories: ['Enterprise', 'Premium', 'Standard', 'Starter'],
  },
  {
    id: 'classify-compliance-risk',
    nodeType: 'ai_classify',
    name: 'Compliance Risk Level',
    description: 'Assess compliance risk category',
    prompt: 'Assess the compliance risk level for {{block.name}} considering regulatory requirements, jurisdiction, and historical compliance record.',
    categories: ['High Risk', 'Medium Risk', 'Low Risk', 'Compliant'],
  },

  // --- Summarise templates ---
  {
    id: 'summarise-executive',
    nodeType: 'ai_summarise',
    name: 'Executive Summary',
    description: 'Generate a comprehensive executive summary',
    prompt: 'Create an executive summary for {{block.name}} covering current status, key metrics, recent developments, and recommended next steps. Include all available context.',
  },
  {
    id: 'summarise-meeting-notes',
    nodeType: 'ai_summarise',
    name: 'Meeting Notes Summary',
    description: 'Summarise recent meeting notes and action items',
    prompt: 'Summarise recent meeting notes related to {{block.name}}. Extract key decisions, action items with owners, and follow-up deadlines.',
  },
  {
    id: 'summarise-deal-progress',
    nodeType: 'ai_summarise',
    name: 'Deal Progress Summary',
    description: 'Summarise deal pipeline progress',
    prompt: 'Summarise the progress of {{block.name}} including stage changes, stakeholder engagement, key milestones hit, and blockers.',
  },
  {
    id: 'summarise-quick-update',
    nodeType: 'ai_summarise',
    name: 'Quick Update',
    description: 'Brief status update from recent activity',
    prompt: 'Provide a brief status update for {{block.name}} based on the 5 most recent events. Keep it concise — 2-3 sentences.',
  },

  // --- Risk Assessment templates ---
  {
    id: 'risk-aml-kyc',
    nodeType: 'ai_risk',
    name: 'AML/KYC Risk',
    description: 'Anti-money laundering and know-your-customer risk assessment',
    prompt: 'Conduct an AML/KYC risk assessment for {{block.name}}. Evaluate identity verification status, transaction patterns, jurisdiction risk, and beneficial ownership structure.',
    riskCategories: ['Identity', 'Transaction', 'Jurisdiction', 'Ownership', 'PEP'],
    includeOrgPolicies: true,
  },
  {
    id: 'risk-deal-score',
    nodeType: 'ai_risk',
    name: 'Deal Risk Score',
    description: 'Evaluate risk factors for a deal',
    prompt: 'Assess risk factors for the deal {{block.name}}. Consider client creditworthiness, market conditions, deal complexity, regulatory requirements, and resource availability.',
    riskCategories: ['Credit', 'Market', 'Operational', 'Regulatory', 'Resource'],
    includeOrgPolicies: false,
  },
  {
    id: 'risk-regulatory-compliance',
    nodeType: 'ai_risk',
    name: 'Regulatory Compliance Check',
    description: 'Check regulatory compliance status',
    prompt: 'Review regulatory compliance for {{block.name}}. Check against applicable regulations, filing deadlines, documentation completeness, and audit readiness.',
    riskCategories: ['Documentation', 'Filing', 'Licensing', 'Reporting', 'Audit'],
    includeOrgPolicies: true,
  },
  {
    id: 'risk-operational',
    nodeType: 'ai_risk',
    name: 'Operational Risk Review',
    description: 'Review operational risks and controls',
    prompt: 'Review operational risks for {{block.name}}. Assess process reliability, dependency risks, capacity constraints, and control effectiveness.',
    riskCategories: ['Process', 'Dependency', 'Capacity', 'Control', 'Continuity'],
    includeOrgPolicies: false,
  },
]

export function getTemplatesForNodeType(nodeType: AIPromptTemplate['nodeType']): AIPromptTemplate[] {
  return AI_PROMPT_TEMPLATES.filter((t) => t.nodeType === nodeType)
}
