/** Step ids align with §6.5 FR-INTERACTIVE-019 (stable product labels). */
export const wizardSteps = [
  { id: 'targets', labelKey: 'wizard.step.targets' as const },
  { id: 'discovery_run', labelKey: 'wizard.step.discovery_run' as const },
  { id: 'discovery_results', labelKey: 'wizard.step.discovery_results' as const },
  { id: 'layout', labelKey: 'wizard.step.layout' as const },
  { id: 'storage', labelKey: 'wizard.step.storage' as const },
  { id: 'network', labelKey: 'wizard.step.network' as const },
  { id: 'security', labelKey: 'wizard.step.security' as const },
  { id: 'artifacts', labelKey: 'wizard.step.artifacts' as const },
  { id: 'database', labelKey: 'wizard.step.database' as const },
  { id: 'review', labelKey: 'wizard.step.review' as const },
  { id: 'run_state', labelKey: 'wizard.step.run_state' as const },
] as const;
