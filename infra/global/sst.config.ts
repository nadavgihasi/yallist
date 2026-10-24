/// <reference path="./.sst/platform/config.d.ts" />

/**
 * Account-wide AWS resources shared by every stage of the app (SST, eu-central-1):
 * the monthly budget and the role GitHub Actions deploys with. One stage only:
 *   pnpm deploy:global   # sst deploy --stage global (BUDGET_EMAIL must be set)
 * Deployed by CI from main; the very first deploy runs locally to create the CI role.
 */
// GitHub issues immutable OIDC subjects for this repo (owner@id/repo@id), which keep matching
// after a rename and can't be claimed by a new repo reusing the name.
// See: gh api repos/nadavgihasi/yallist/actions/oidc/customization/sub
const REPO_SUBJECT = 'repo:nadavgihasi@37207301/yallist@1431912139';
const GITHUB_OIDC = 'token.actions.githubusercontent.com';

export default $config({
  app(input) {
    if (input?.stage !== 'global') {
      throw new Error(`Unknown stage "${input?.stage}". Pass --stage global.`);
    }
    return {
      name: 'yallist-global',
      removal: 'retain',
      protect: true,
      home: 'aws',
      providers: {
        aws: {
          region: 'eu-central-1',
          // CI gets credentials from the GitHub OIDC role instead.
          profile: process.env.CI ? undefined : 'yallist-dev',
          defaultTags: { tags: { app: 'yallist', stage: 'global' } },
        },
      },
    };
  },
  async run() {
    const email = process.env.BUDGET_EMAIL;
    if (!email) throw new Error('Set BUDGET_EMAIL (GitHub variable) to receive budget alerts.');

    new aws.budgets.Budget('MonthlyBudget', {
      name: 'yallist-global-monthly',
      budgetType: 'COST',
      limitAmount: '10',
      limitUnit: 'USD',
      timeUnit: 'MONTHLY',
      notifications: [
        { notificationType: 'ACTUAL', threshold: 80 },
        { notificationType: 'FORECASTED', threshold: 100 },
      ].map((n) => ({
        ...n,
        comparisonOperator: 'GREATER_THAN',
        thresholdType: 'PERCENTAGE',
        subscriberEmailAddresses: [email],
      })),
    });

    const github = new aws.iam.OpenIdConnectProvider('GithubOidc', {
      url: `https://${GITHUB_OIDC}`,
      clientIdLists: ['sts.amazonaws.com'],
    });

    // Only workflow jobs running in a GitHub environment of this repo can assume the role;
    // the environments only accept the main branch, so PRs and forks can't.
    const deployRole = new aws.iam.Role('GithubDeployRole', {
      name: 'yallist-global-github-deploy',
      assumeRolePolicy: $jsonStringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { Federated: github.arn },
            Action: 'sts:AssumeRoleWithWebIdentity',
            Condition: {
              StringEquals: { [`${GITHUB_OIDC}:aud`]: 'sts.amazonaws.com' },
              StringLike: { [`${GITHUB_OIDC}:sub`]: `${REPO_SUBJECT}:environment:*` },
            },
          },
        ],
      }),
    });
    // SST creates IAM roles, CloudFront, S3 and Lambda resources; narrow this once the stack settles.
    new aws.iam.RolePolicyAttachment('GithubDeployAdmin', {
      role: deployRole.name,
      policyArn: 'arn:aws:iam::aws:policy/AdministratorAccess',
    });

    return { deployRoleArn: deployRole.arn };
  },
});
