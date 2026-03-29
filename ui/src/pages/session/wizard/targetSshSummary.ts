import * as i18n from '@/i18n';
import type { ConfigurationDraft, DefaultSshAuthMode, TargetRowAuthMode } from './configurationDraft';
import type { TargetFormRow } from './targetForm';

/** Matches project `t()` for typed message keys. */
export type TFn = typeof i18n.t;

function defaultAuthModeLabel(mode: DefaultSshAuthMode, t: TFn): string {
  switch (mode) {
    case 'password':
      return t('wizard.targets.authModePassword');
    case 'secret_key':
      return t('wizard.targets.authModeSecretKey');
    case 'agent':
      return t('wizard.targets.authModeAgent');
    default:
      return mode;
  }
}

function formatSshUserDisplay(raw: string | undefined | null, t: TFn): string {
  const u = (raw ?? '').trim();
  return u.length > 0 ? u : t('wizard.targets.sshUserUnconfigured');
}

function rowAuthModeLabel(mode: TargetRowAuthMode, t: TFn): string {
  switch (mode) {
    case 'default':
      return t('wizard.targets.authModeDefault');
    case 'password':
      return t('wizard.targets.authModePassword');
    case 'secret_key':
      return t('wizard.targets.authModeSecretKey');
    case 'agent':
      return t('wizard.targets.authModeAgent');
    default:
      return mode;
  }
}

/** Multi-line strings for read-only default SSH block (same structure as per-target table cell). */
export function defaultSshSummaryLines(draft: ConfigurationDraft, t: TFn): string[] {
  const { authMode, port, user, passwordSet, keySelected } = draft.defaultSsh;
  const lines: string[] = [
    `${t('wizard.targets.defaultAuthModeLabel')}: ${defaultAuthModeLabel(authMode, t)}`,
    `${t('wizard.field.sshPort')}: ${port}`,
    `${t('wizard.field.sshUser')}: ${formatSshUserDisplay(user, t)}`,
  ];
  if (authMode === 'password') {
    lines.push(
      `${t('wizard.field.sshPassword')}: ${passwordSet ? t('wizard.targets.passwordSet') : t('wizard.targets.passwordNotSet')}`,
    );
  }
  if (authMode === 'secret_key') {
    lines.push(
      `${t('wizard.targets.uploadKey')}: ${keySelected ? t('wizard.targets.keySelected') : t('wizard.targets.keyNotSelected')}`,
    );
  }
  return lines;
}

/** Multi-line strings for a target row (matches default block field order and labels for overrides). */
export function rowSshSummaryLines(
  row: TargetFormRow,
  rowMode: TargetRowAuthMode,
  t: TFn,
): string[] {
  if (rowMode === 'default') {
    return [t('wizard.targets.usingDefaultSshSettings')];
  }

  const port = row.sshPort > 0 ? row.sshPort : 22;
  const lines: string[] = [
    `${t('wizard.targets.defaultAuthModeLabel')}: ${rowAuthModeLabel(rowMode, t)}`,
    `${t('wizard.field.sshPort')}: ${port}`,
    `${t('wizard.field.sshUser')}: ${formatSshUserDisplay(row.user, t)}`,
  ];
  if (rowMode === 'password') {
    const set = Boolean(row.sshPassword?.trim());
    lines.push(
      `${t('wizard.field.sshPassword')}: ${set ? t('wizard.targets.passwordSet') : t('wizard.targets.passwordNotSet')}`,
    );
  }
  if (rowMode === 'secret_key') {
    lines.push(
      `${t('wizard.targets.uploadKey')}: ${row.sshKeySelected ? t('wizard.targets.keySelected') : t('wizard.targets.keyNotSelected')}`,
    );
  }
  return lines;
}
