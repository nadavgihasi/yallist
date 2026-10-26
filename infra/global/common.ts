// GitHub issues immutable OIDC subjects for this repo (owner@id/repo@id), which keep matching
// after a rename and can't be claimed by a new repo reusing the name.
// See: gh api repos/nadavgihasi/yallist/actions/oidc/customization/sub
export const REPO_SUBJECT = 'repo:nadavgihasi@37207301/yallist@1431912139';
export const GITHUB_OIDC = 'token.actions.githubusercontent.com';

/** Email at 80% of the budget spent and when 100% is forecast. */
export function budgetAlerts(email: string) {
  return [
    { notificationType: 'ACTUAL', threshold: 80 },
    { notificationType: 'FORECASTED', threshold: 100 },
  ].map((n) => ({
    ...n,
    comparisonOperator: 'GREATER_THAN',
    thresholdType: 'PERCENTAGE',
    subscriberEmailAddresses: [email],
  }));
}
