import type { StepHandler } from './types'

interface RouteBranch {
  value: string
  label?: string
}

/**
 * Route step handler — evaluates route_field against context and returns
 * which branch was matched. The step engine uses next_step_name from the
 * output to jump to the correct downstream step.
 */
const handler: StepHandler = async (step, meta, orgId, supabase) => {
  const now = new Date().toISOString()

  const routeField = (step as Record<string, unknown>).route_field as string | undefined
  const branches = (step as Record<string, unknown>).route_branches as RouteBranch[] | undefined
  const branchTargets = (step as Record<string, unknown>).route_branch_targets as Record<string, string> | undefined

  if (!routeField) {
    return {
      step_name: step.name,
      step_type: step.type,
      status: 'completed',
      output: { matched_branch: 'default', reason: 'No route_field configured' },
      executed_at: now,
    }
  }

  // Resolve the field value from context
  // route_field format: "block.field" or "context.path.to.value"
  let fieldValue: unknown

  // Load source block data for block.* fields
  if (routeField.startsWith('block.')) {
    const fieldName = routeField.slice(6)
    if (meta.source_block_id) {
      const { data: block } = await supabase
        .from('blocks')
        .select('type, name, metadata')
        .eq('id', meta.source_block_id)
        .single()

      if (block) {
        if (fieldName === 'type') fieldValue = block.type
        else if (fieldName === 'name') fieldValue = block.name
        else {
          const blockMeta = (block.metadata ?? {}) as Record<string, unknown>
          fieldValue = blockMeta[fieldName]
        }
      }
    }
  } else if (routeField.startsWith('context.')) {
    // Look through previous step results for context values
    const path = routeField.slice(8).split('.')
    for (const result of [...meta.step_results].reverse()) {
      if (result.output) {
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
        if (found && current !== undefined) {
          fieldValue = current
          break
        }
      }
    }
  }

  const fieldStr = fieldValue != null ? String(fieldValue) : ''

  // Match against branches
  let matchedBranch = 'default'
  let matchedTarget: string | undefined

  if (branches) {
    for (let i = 0; i < branches.length; i++) {
      if (branches[i].value === fieldStr) {
        matchedBranch = branches[i].label || branches[i].value
        if (branchTargets) {
          matchedTarget = branchTargets[`branch-${i}`]
        }
        break
      }
    }
  }

  if (matchedBranch === 'default' && branchTargets?.default) {
    matchedTarget = branchTargets.default
  }

  return {
    step_name: step.name,
    step_type: step.type,
    status: 'completed',
    output: {
      route_field: routeField,
      field_value: fieldStr,
      matched_branch: matchedBranch,
      ...(matchedTarget ? { next_step_name: matchedTarget } : {}),
    },
    executed_at: now,
  }
}

export default handler
