import { OrganizationList } from '@clerk/nextjs'

export default function OrgSetupPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Select your organisation</h1>
        <p className="mt-2 text-muted-foreground">
          Choose an existing organisation or create a new one to get started.
        </p>
      </div>
      <OrganizationList
        hidePersonal
        afterSelectOrganizationUrl="/dashboard"
        afterCreateOrganizationUrl="/dashboard"
      />
    </div>
  )
}
