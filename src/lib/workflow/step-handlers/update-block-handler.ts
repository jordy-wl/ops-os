import type { StepHandler } from './types'
import { executeUpdateBlock } from './update-block'

const handler: StepHandler = async (step, meta, orgId, supabase) => {
  const stepAny = step as Record<string, unknown>
  const updateConfig = {
    block_id: (stepAny.block_id as string) ?? meta.source_block_id,
    fields: (stepAny.fields as Record<string, unknown>) ?? {},
  }
  return await executeUpdateBlock(step.name, updateConfig, meta, orgId, supabase)
}

export default handler
