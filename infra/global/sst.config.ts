/// <reference path="./.sst/platform/config.d.ts" />

/**
 * Account-wide AWS resources shared by every stage of the app (SST, eu-central-1): the budgets,
 * the role GitHub Actions deploys with and the narrower one PR previews deploy with. One stage only:
 *   pnpm deploy:global   # sst deploy --stage global (BUDGET_EMAIL must be set)
 * Deployed by CI from main; the very first deploy runs locally to create the CI role.
 */
// GitHub issues immutable OIDC subjects for this repo (owner@id/repo@id), which keep matching
// after a rename and can't be claimed by a new repo reusing the name.
// See: gh api repos/nadavgihasi/yallist/actions/oidc/customization/sub
const REPO_SUBJECT = 'repo:nadavgihasi@37207301/yallist@1431912139';
const GITHUB_OIDC = 'token.actions.githubusercontent.com';

// PR previews (docs/plans/e2e-live-environments.md): their region, and the GitHub users (numeric
// ids, `gh api users/<login> -q .id`) whose workflow runs may assume the preview role. Keep in
// sync with the repo variable PREVIEW_ALLOWED_ACTORS (logins), which preview.yml checks first.
const PREVIEW_REGION = 'us-west-2';
const PREVIEW_ACTOR_IDS = ['37207301']; // nadavgihasi

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
      notifications: budgetAlerts(email),
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

    const preview = previewRole(github.arn, email);

    return { deployRoleArn: deployRole.arn, previewRoleArn: preview.arn };
  },
});

/**
 * The role preview.yml deploys and removes `pr-<n>` stages with. Least privilege: a bug in the
 * app's sst.config.ts or the workflow can only touch `yallist-pr-*` resources in us-west-2, never
 * dev, production, global or the shared preview stage. Not a wall against a deliberate attacker
 * (who could use the admin role from any environment; see the plan's security section).
 * CloudTrail will show what the first runs miss.
 */
function previewRole(githubOidcArn: $util.Output<string>, email: string) {
  const account = aws.getCallerIdentityOutput().accountId;
  const arn = (service: string, resource: string) =>
    $interpolate`arn:aws:${service}:${PREVIEW_REGION}:${account}:${resource}`;

  // The most any role a PR stage creates (its Lambdas') can do: only its own stage's resources,
  // matched through the `stage` tag every role gets from SST's default tags.
  const boundary = new aws.iam.Policy('PreviewWorkloadBoundary', {
    name: 'yallist-preview-workload-boundary',
    policy: $jsonStringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
          Resource: arn('logs', 'log-group:/aws/lambda/yallist-${aws:PrincipalTag/stage}-*'),
        },
        {
          Effect: 'Allow',
          Action: ['dsql:DbConnect', 'dsql:DbConnectAdmin'],
          Resource: arn('dsql', 'cluster/*'),
          Condition: {
            StringEquals: { 'aws:ResourceTag/stage': '${aws:PrincipalTag/stage}' },
          },
        },
        {
          // Only previews have Event APIs in this region, and their ARNs only have ids.
          Effect: 'Allow',
          Action: 'appsync:EventPublish',
          Resource: arn('appsync', 'apis/*'),
        },
        {
          // ListBucket makes HeadObject on a missing receipt a 404, not a 403.
          Effect: 'Allow',
          Action: 's3:ListBucket',
          Resource: 'arn:aws:s3:::yallist-${aws:PrincipalTag/stage}-*',
        },
        {
          Effect: 'Allow',
          Action: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
          Resource: 'arn:aws:s3:::yallist-${aws:PrincipalTag/stage}-*/*',
        },
      ],
    }),
  });

  const role = new aws.iam.Role('GithubPreviewRole', {
    name: 'yallist-global-github-preview',
    maxSessionDuration: 3600,
    // Only jobs in the `preview` environment, started by an allowed user. Needs the repo's OIDC
    // subject template to include actor_id (docs/deploy.md#pr-previews).
    assumeRolePolicy: $jsonStringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { Federated: githubOidcArn },
          Action: 'sts:AssumeRoleWithWebIdentity',
          Condition: {
            StringEquals: {
              [`${GITHUB_OIDC}:aud`]: 'sts.amazonaws.com',
              [`${GITHUB_OIDC}:sub`]: PREVIEW_ACTOR_IDS.map(
                (id) => `${REPO_SUBJECT}:environment:preview:actor_id:${id}`,
              ),
            },
          },
        },
      ],
    }),
  });

  new aws.iam.RolePolicy('GithubPreviewPolicy', {
    role: role.name,
    policy: $jsonStringify({
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'OnlyPreviewRegion',
          Effect: 'Deny',
          NotAction: ['iam:*', 'sts:*', 'cloudfront:*', 'cloudfront-keyvaluestore:*'],
          Resource: '*',
          Condition: { StringNotEquals: { 'aws:RequestedRegion': PREVIEW_REGION } },
        },
        {
          Sid: 'KeepTheBoundary',
          Effect: 'Deny',
          Action: ['iam:DeleteRolePermissionsBoundary', 'iam:CreatePolicyVersion'],
          Resource: '*',
        },
        {
          Sid: 'RolesOnlyWithTheBoundary',
          Effect: 'Allow',
          Action: ['iam:CreateRole', 'iam:PutRolePermissionsBoundary'],
          Resource: $interpolate`arn:aws:iam::${account}:role/yallist-pr-*`,
          Condition: { StringEquals: { 'iam:PermissionsBoundary': boundary.arn } },
        },
        {
          Sid: 'PrRoles',
          Effect: 'Allow',
          Action: [
            'iam:GetRole',
            'iam:DeleteRole',
            'iam:TagRole',
            'iam:UntagRole',
            'iam:UpdateRole',
            'iam:UpdateAssumeRolePolicy',
            'iam:GetRolePolicy',
            'iam:PutRolePolicy',
            'iam:DeleteRolePolicy',
            'iam:ListRolePolicies',
            'iam:ListAttachedRolePolicies',
            'iam:AttachRolePolicy',
            'iam:DetachRolePolicy',
            'iam:ListInstanceProfilesForRole',
            'iam:PassRole',
          ],
          Resource: $interpolate`arn:aws:iam::${account}:role/yallist-pr-*`,
        },
        {
          Sid: 'PrLambdas',
          Effect: 'Allow',
          Action: 'lambda:*',
          Resource: arn('lambda', 'function:yallist-pr-*'),
        },
        {
          Sid: 'PrLogs',
          Effect: 'Allow',
          Action: 'logs:*',
          Resource: [
            arn('logs', 'log-group:/aws/lambda/yallist-pr-*'),
            arn('logs', 'log-group:/aws/lambda/yallist-pr-*:*'),
          ],
        },
        { Sid: 'ListLogs', Effect: 'Allow', Action: 'logs:DescribeLogGroups', Resource: '*' },
        {
          Sid: 'PrBuckets',
          Effect: 'Allow',
          Action: 's3:*',
          Resource: ['arn:aws:s3:::yallist-pr-*', 'arn:aws:s3:::yallist-pr-*/*'],
        },
        {
          // SST's per-region bootstrap: its state (one key per stage) and its uploaded assets.
          Sid: 'SstBuckets',
          Effect: 'Allow',
          Action: ['s3:ListBucket', 's3:GetBucketLocation'],
          Resource: ['arn:aws:s3:::sst-state-*', 'arn:aws:s3:::sst-asset-*'],
        },
        {
          Sid: 'SstPrState',
          Effect: 'Allow',
          Action: ['s3:GetObject*', 's3:PutObject*', 's3:DeleteObject*'],
          Resource: ['arn:aws:s3:::sst-state-*/*/yallist/pr-*', 'arn:aws:s3:::sst-asset-*/*'],
        },
        {
          Sid: 'SstParameters',
          Effect: 'Allow',
          Action: ['ssm:GetParameter', 'ssm:GetParameters'],
          Resource: [
            arn('ssm', 'parameter/sst/bootstrap'),
            arn('ssm', 'parameter/yallist/preview/*'),
          ],
        },
        {
          Sid: 'SstPrPassphrases',
          Effect: 'Allow',
          Action: [
            'ssm:GetParameter',
            'ssm:PutParameter',
            'ssm:DeleteParameter',
            'ssm:AddTagsToResource',
          ],
          Resource: arn('ssm', 'parameter/sst/passphrase/yallist/pr-*'),
        },
        {
          Sid: 'CreatePrClusters',
          Effect: 'Allow',
          Action: ['dsql:CreateCluster', 'dsql:TagResource'],
          Resource: arn('dsql', 'cluster/*'),
          Condition: { StringLike: { 'aws:RequestTag/stage': 'pr-*' } },
        },
        {
          Sid: 'PrClusters',
          Effect: 'Allow',
          Action: 'dsql:*',
          Resource: arn('dsql', 'cluster/*'),
          Condition: { StringLike: { 'aws:ResourceTag/stage': 'pr-*' } },
        },
        {
          // Event APIs are named, but their ARNs only have ids; only previews live in this region.
          Sid: 'Realtime',
          Effect: 'Allow',
          Action: 'appsync:*',
          Resource: '*',
        },
        {
          // A PR's route and integration on the preview stage's HTTP API, the only one in this
          // region. Its id isn't known here (the preview stage deploys after global).
          Sid: 'PrRoutes',
          Effect: 'Allow',
          Action: ['apigateway:GET', 'apigateway:POST', 'apigateway:PATCH', 'apigateway:DELETE'],
          Resource: [
            $interpolate`arn:aws:apigateway:${PREVIEW_REGION}::/apis/*`,
            $interpolate`arn:aws:apigateway:${PREVIEW_REGION}::/apis/*/routes*`,
            $interpolate`arn:aws:apigateway:${PREVIEW_REGION}::/apis/*/integrations*`,
          ],
        },
        {
          // The preview Router: read its tags (Router.get) and invalidate a PR's paths.
          Sid: 'PreviewRouter',
          Effect: 'Allow',
          Action: [
            'cloudfront:GetDistribution',
            'cloudfront:ListTagsForResource',
            'cloudfront:CreateInvalidation',
            'cloudfront:GetInvalidation',
          ],
          Resource: $interpolate`arn:aws:cloudfront::${account}:distribution/*`,
          Condition: { StringEquals: { 'aws:ResourceTag/stage': 'preview' } },
        },
        {
          // A PR's routes and file entries in the Router's KV store. Stores have no tags or names
          // to narrow this by.
          Sid: 'RouterKeyValueStore',
          Effect: 'Allow',
          Action: ['cloudfront:DescribeKeyValueStore', 'cloudfront-keyvaluestore:*'],
          Resource: $interpolate`arn:aws:cloudfront::${account}:key-value-store/*`,
        },
        {
          // Finding leftover PR stages (preview.yml, remove and expire).
          Sid: 'FindPrResources',
          Effect: 'Allow',
          Action: 'tag:GetResources',
          Resource: '*',
        },
      ],
    }),
  });

  new aws.budgets.Budget('PreviewBudget', {
    name: 'yallist-global-preview',
    budgetType: 'COST',
    limitAmount: '5',
    limitUnit: 'USD',
    timeUnit: 'MONTHLY',
    costFilters: [{ name: 'Region', values: [PREVIEW_REGION] }],
    notifications: budgetAlerts(email),
  });

  return role;
}

/** Email at 80% of the budget spent and when 100% is forecast. */
function budgetAlerts(email: string) {
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
