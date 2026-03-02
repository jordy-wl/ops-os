import { CreateOrganization } from '@clerk/nextjs'

export default function OrgSetupPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Set up your organisation</h1>
        <p className="mt-2 text-gray-500">
          Ops OS is organised by firm. Create your organisation to get started.
        </p>
      </div>
      <CreateOrganization afterCreateOrganizationUrl="/dashboard" />
    </div>
  )
}
