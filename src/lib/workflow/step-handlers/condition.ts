import { logger } from '@/lib/logger'
import type { StepHandler, InstanceMetadata } from './types'
import type { createServerClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Types (mirror the ConditionBuilder UI types for server-side evaluation)
// ---------------------------------------------------------------------------

type ConditionOperator =
  | 'is'
  | 'is_not'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'is_empty'
  | 'is_not_empty'

type ConditionLogic = 'and' | 'or'

interface SingleCondition {
  field: string
  operator: ConditionOperator
  value: string
}

interface ConditionGroup {
  logic: ConditionLogic
  conditions: SingleCondition[]
}

interface ConditionValue {
  mode: 'simple' | 'compound' | 'advanced'
  simple?: SingleCondition
  compound?: ConditionGroup
  advanced?: string
}

interface EvaluatedCondition {
  field: string
  operator: ConditionOperator
  expected: string
  actual: string
  result: boolean
}

// ---------------------------------------------------------------------------
// Field Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a field path to its value.
 *
 * - "block.<field>" loads the source block from Supabase. Top-level fields
 *   (type, name) are accessed directly; everything else comes from metadata.
 * - "context.<path>" walks through previous step_results outputs.
 * - Anything else is treated as a literal string value.
 */
async function resolveFieldValue(
  field: string,
  meta: InstanceMetadata,
  supabase: ReturnType<typeof createServerClient>
): Promise<string> {
  if (field.startsWith('block.')) {
    const fieldName = field.slice(6) // strip "block."
    if (!meta.source_block_id) return ''

    const { data: block } = await supabase
      .from('blocks')
      .select('type, name, metadata')
      .eq('id', meta.source_block_id)
      .single()

    if (!block) return ''

    if (fieldName === 'type') return block.type ?? ''
    if (fieldName === 'name') return block.name ?? ''

    // Walk into metadata using dot-separated path
    const metadataPath = fieldName.split('.')
    let current: unknown = block.metadata ?? {}
    for (const segment of metadataPath) {
      if (current && typeof current === 'object' && segment in current) {
        current = (current as Record<string, unknown>)[segment]
      } else {
        return ''
      }
    }
    if (current === undefined || current === null) return ''
    return typeof current === 'object' ? JSON.stringify(current) : String(current)
  }

  if (field.startsWith('context.')) {
    const path = field.slice(8).split('.') // strip "context."
    // Walk step_results in reverse to find the most recent matching output
    for (const result of [...meta.step_results].reverse()) {
      if (!result.output) continue

      let current: unknown = result.output
      let found = true
      for (const segment of path) {
        if (current && typeof current === 'object' && segment in current) {
          current = (current as Record<string, unknown>)[segment]
        } else {
          found = false
          break
        }
      }
      if (found && current !== undefined && current !== null) {
        return typeof current === 'object' ? JSON.stringify(current) : String(current)
      }
    }
    return ''
  }

  // Literal value — return as-is
  return field
}

// ---------------------------------------------------------------------------
// Operator Evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate a single operator against an actual value and an expected value.
 *
 * - is / is_not: strict string equality
 * - contains / not_contains: string includes
 * - greater_than / less_than: numeric comparison (parseFloat)
 * - is_empty: null, undefined, or empty string
 * - is_not_empty: not null, not undefined, not empty string
 */
function evaluateOperator(
  operator: ConditionOperator,
  actual: string,
  expected: string
): boolean {
  switch (operator) {
    case 'is':
      return actual === expected
    case 'is_not':
      return actual !== expected
    case 'contains':
      return actual.includes(expected)
    case 'not_contains':
      return !actual.includes(expected)
    case 'greater_than': {
      const numActual = parseFloat(actual)
      const numExpected = parseFloat(expected)
      if (isNaN(numActual) || isNaN(numExpected)) return false
      return numActual > numExpected
    }
    case 'less_than': {
      const numActual = parseFloat(actual)
      const numExpected = parseFloat(expected)
      if (isNaN(numActual) || isNaN(numExpected)) return false
      return numActual < numExpected
    }
    case 'is_empty':
      return actual === ''
    case 'is_not_empty':
      return actual !== ''
    default:
      return false
  }
}

// ---------------------------------------------------------------------------
// Condition Evaluators
// ---------------------------------------------------------------------------

/**
 * Evaluate a single condition: resolve the field, apply the operator.
 */
async function evaluateSingleCondition(
  condition: SingleCondition,
  meta: InstanceMetadata,
  supabase: ReturnType<typeof createServerClient>
): Promise<EvaluatedCondition> {
  const actual = await resolveFieldValue(condition.field, meta, supabase)
  const result = evaluateOperator(condition.operator, actual, condition.value)

  return {
    field: condition.field,
    operator: condition.operator,
    expected: condition.value,
    actual,
    result,
  }
}

/**
 * Evaluate a compound condition group (AND/OR logic).
 */
async function evaluateCompoundCondition(
  group: ConditionGroup,
  meta: InstanceMetadata,
  supabase: ReturnType<typeof createServerClient>
): Promise<{ result: boolean; evaluated: EvaluatedCondition[] }> {
  const evaluated: EvaluatedCondition[] = []

  for (const condition of group.conditions) {
    const evalResult = await evaluateSingleCondition(condition, meta, supabase)
    evaluated.push(evalResult)

    // Short-circuit: for AND, stop on first false; for OR, stop on first true
    if (group.logic === 'and' && !evalResult.result) {
      return { result: false, evaluated }
    }
    if (group.logic === 'or' && evalResult.result) {
      return { result: true, evaluated }
    }
  }

  // If we made it here:
  // - AND logic: all conditions were true
  // - OR logic: no condition was true
  return {
    result: group.logic === 'and',
    evaluated,
  }
}

/**
 * Evaluate an advanced expression string.
 *
 * Interpolates {{block.*}} and {{context.*}} variables, then checks whether
 * the result is truthy. For Sprint 23, we support common equality patterns
 * and fall back to basic truthiness checking.
 */
async function evaluateAdvancedExpression(
  expression: string,
  meta: InstanceMetadata,
  supabase: ReturnType<typeof createServerClient>
): Promise<{ result: boolean; interpolated: string }> {
  // Find all {{...}} variable references
  const variablePattern = /\{\{(\w+(?:\.\w+)*)\}\}/g
  let interpolated = expression
  const matches = expression.matchAll(variablePattern)

  for (const match of matches) {
    const fullMatch = match[0] // e.g. "{{block.status}}"
    const fieldPath = match[1]  // e.g. "block.status"
    const resolved = await resolveFieldValue(fieldPath, meta, supabase)
    interpolated = interpolated.replace(fullMatch, resolved)
  }

  // Evaluate the interpolated string for truthiness
  const result = evaluateTruthiness(interpolated)

  return { result, interpolated }
}

/**
 * Determine whether an interpolated expression string is truthy.
 *
 * Supports:
 * - Empty string / whitespace-only => false
 * - Literal "false", "0", "null", "undefined" => false
 * - Simple equality:  value === "expected" or value == "expected"
 * - Simple inequality: value !== "expected" or value != "expected"
 * - Simple comparisons: value > number, value < number, value >= number, value <= number
 * - Logical AND/OR: expr1 && expr2, expr1 || expr2
 * - Everything else => true (non-empty string is truthy)
 */
function evaluateTruthiness(expr: string): boolean {
  const trimmed = expr.trim()

  // Empty => false
  if (trimmed === '') return false

  // Explicit falsy literals
  const lowerTrimmed = trimmed.toLowerCase()
  if (lowerTrimmed === 'false' || lowerTrimmed === '0' || lowerTrimmed === 'null' || lowerTrimmed === 'undefined') {
    return false
  }

  // Logical AND: split on && and require all parts truthy
  if (trimmed.includes('&&')) {
    const parts = trimmed.split('&&')
    return parts.every((part) => evaluateTruthiness(part))
  }

  // Logical OR: split on || and require any part truthy
  if (trimmed.includes('||')) {
    const parts = trimmed.split('||')
    return parts.some((part) => evaluateTruthiness(part))
  }

  // Strict equality: left === "right" or left === right
  const strictEqMatch = trimmed.match(/^(.+?)\s*===\s*(.+)$/)
  if (strictEqMatch) {
    const left = unquote(strictEqMatch[1].trim())
    const right = unquote(strictEqMatch[2].trim())
    return left === right
  }

  // Strict inequality: left !== "right"
  const strictNeqMatch = trimmed.match(/^(.+?)\s*!==\s*(.+)$/)
  if (strictNeqMatch) {
    const left = unquote(strictNeqMatch[1].trim())
    const right = unquote(strictNeqMatch[2].trim())
    return left !== right
  }

  // Loose equality: left == "right"
  const looseEqMatch = trimmed.match(/^(.+?)\s*==\s*(.+)$/)
  if (looseEqMatch) {
    const left = unquote(looseEqMatch[1].trim())
    const right = unquote(looseEqMatch[2].trim())
    return left === right
  }

  // Loose inequality: left != "right"
  const looseNeqMatch = trimmed.match(/^(.+?)\s*!=\s*(.+)$/)
  if (looseNeqMatch) {
    const left = unquote(looseNeqMatch[1].trim())
    const right = unquote(looseNeqMatch[2].trim())
    return left !== right
  }

  // Greater than or equal: left >= right
  const gteMatch = trimmed.match(/^(.+?)\s*>=\s*(.+)$/)
  if (gteMatch) {
    const left = parseFloat(gteMatch[1].trim())
    const right = parseFloat(gteMatch[2].trim())
    if (!isNaN(left) && !isNaN(right)) return left >= right
    return false
  }

  // Less than or equal: left <= right
  const lteMatch = trimmed.match(/^(.+?)\s*<=\s*(.+)$/)
  if (lteMatch) {
    const left = parseFloat(lteMatch[1].trim())
    const right = parseFloat(lteMatch[2].trim())
    if (!isNaN(left) && !isNaN(right)) return left <= right
    return false
  }

  // Greater than: left > right
  const gtMatch = trimmed.match(/^(.+?)\s*>\s*(.+)$/)
  if (gtMatch) {
    const left = parseFloat(gtMatch[1].trim())
    const right = parseFloat(gtMatch[2].trim())
    if (!isNaN(left) && !isNaN(right)) return left > right
    return false
  }

  // Less than: left < right
  const ltMatch = trimmed.match(/^(.+?)\s*<\s*(.+)$/)
  if (ltMatch) {
    const left = parseFloat(ltMatch[1].trim())
    const right = parseFloat(ltMatch[2].trim())
    if (!isNaN(left) && !isNaN(right)) return left < right
    return false
  }

  // Anything else that's non-empty => truthy
  return true
}

/** Strip surrounding quotes from a value if present. */
function unquote(val: string): string {
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    return val.slice(1, -1)
  }
  return val
}

// ---------------------------------------------------------------------------
// Main Handler
// ---------------------------------------------------------------------------

const handler: StepHandler = async (step, meta, orgId, supabase) => {
  const now = new Date().toISOString()
  const stepRecord = step as Record<string, unknown>

  // Determine which condition format is being used
  const conditionValue = stepRecord.condition_value as ConditionValue | undefined
  const legacyCondition = step.condition

  try {
    // 1. New format: ConditionValue from ConditionBuilder
    if (conditionValue && conditionValue.mode) {
      const { mode } = conditionValue

      if (mode === 'simple' && conditionValue.simple) {
        const evalResult = await evaluateSingleCondition(conditionValue.simple, meta, supabase)

        logger.info('condition-handler', 'condition.evaluated', {
          step_name: step.name,
          mode: 'simple',
          result: evalResult.result,
        })

        return {
          step_name: step.name,
          step_type: step.type,
          status: 'completed',
          output: {
            condition_mode: 'simple' as const,
            result: evalResult.result,
            evaluated_conditions: [evalResult],
          },
          executed_at: now,
        }
      }

      if (mode === 'compound' && conditionValue.compound) {
        const { result, evaluated } = await evaluateCompoundCondition(
          conditionValue.compound,
          meta,
          supabase
        )

        logger.info('condition-handler', 'condition.evaluated', {
          step_name: step.name,
          mode: 'compound',
          logic: conditionValue.compound.logic,
          condition_count: conditionValue.compound.conditions.length,
          result,
        })

        return {
          step_name: step.name,
          step_type: step.type,
          status: 'completed',
          output: {
            condition_mode: 'compound' as const,
            logic: conditionValue.compound.logic,
            result,
            evaluated_conditions: evaluated,
          },
          executed_at: now,
        }
      }

      if (mode === 'advanced' && conditionValue.advanced) {
        const { result, interpolated } = await evaluateAdvancedExpression(
          conditionValue.advanced,
          meta,
          supabase
        )

        logger.info('condition-handler', 'condition.evaluated', {
          step_name: step.name,
          mode: 'advanced',
          result,
        })

        return {
          step_name: step.name,
          step_type: step.type,
          status: 'completed',
          output: {
            condition_mode: 'advanced' as const,
            result,
            interpolated_expression: interpolated,
          },
          executed_at: now,
        }
      }

      // ConditionValue exists but the active mode has no data — default to true
      logger.warn('condition-handler', 'condition.empty_mode', {
        step_name: step.name,
        mode,
      })

      return {
        step_name: step.name,
        step_type: step.type,
        status: 'completed',
        output: {
          condition_mode: mode,
          result: true,
          reason: 'No condition data for the selected mode; defaulting to true',
        },
        executed_at: now,
      }
    }

    // 2. Legacy format: plain string condition
    if (legacyCondition) {
      // Treat as an advanced expression — interpolate and evaluate
      const { result, interpolated } = await evaluateAdvancedExpression(
        legacyCondition,
        meta,
        supabase
      )

      logger.info('condition-handler', 'condition.evaluated', {
        step_name: step.name,
        mode: 'legacy',
        result,
      })

      return {
        step_name: step.name,
        step_type: step.type,
        status: 'completed',
        output: {
          condition_mode: 'legacy' as const,
          result,
          interpolated_expression: interpolated,
        },
        executed_at: now,
      }
    }

    // 3. No condition configured at all — default to true
    logger.warn('condition-handler', 'condition.no_config', {
      step_name: step.name,
    })

    return {
      step_name: step.name,
      step_type: step.type,
      status: 'completed',
      output: {
        condition_mode: 'legacy' as const,
        result: true,
        reason: 'No condition configured; defaulting to true',
      },
      executed_at: now,
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error during condition evaluation'

    logger.error('condition-handler', 'condition.evaluation_failed', {
      step_name: step.name,
      error_code: errorMsg,
    })

    return {
      step_name: step.name,
      step_type: step.type,
      status: 'failed',
      error: errorMsg,
      executed_at: now,
    }
  }
}

export default handler

// ---------------------------------------------------------------------------
// Exported for testing
// ---------------------------------------------------------------------------

export {
  evaluateOperator,
  evaluateSingleCondition,
  evaluateCompoundCondition,
  evaluateAdvancedExpression,
  evaluateTruthiness,
  resolveFieldValue,
}

export type {
  ConditionValue,
  ConditionOperator,
  ConditionLogic,
  SingleCondition,
  ConditionGroup,
  EvaluatedCondition,
}
