/** Wizard sections aligned with FR-INTERACTIVE-005 (logical order). */
export const wizardSteps = [
  { id: 'targets', labelKey: 'wizard.step.targets' as const },
  { id: 'auth', labelKey: 'wizard.step.auth' as const },
  { id: 'discovery', labelKey: 'wizard.step.discovery' as const },
  { id: 'layout', labelKey: 'wizard.step.layout' as const },
  { id: 'storage', labelKey: 'wizard.step.storage' as const },
  { id: 'network', labelKey: 'wizard.step.network' as const },
  { id: 'security', labelKey: 'wizard.step.security' as const },
  { id: 'artifacts', labelKey: 'wizard.step.artifacts' as const },
  { id: 'database', labelKey: 'wizard.step.database' as const },
  { id: 'review', labelKey: 'wizard.step.review' as const },
] as const;
