// eslint-disable-next-line import/no-extraneous-dependencies
/// !cdk-integ PipelineStack pragma:set-context:@aws-cdk/core:newStyleStackSynthesis=true
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { App, Stack, StackProps, Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as pipelines from 'aws-cdk-lib/pipelines';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as integ from '@aws-cdk/integ-tests-alpha';

class PipelineStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const bucket = s3.Bucket.fromBucketName(this, 'LogBucket', 'bucket-name');
    const logGroup = logs.LogGroup.fromLogGroupName(this, 'LogGroup', 'log-group-name');

    const pipeline = new pipelines.CodePipeline(this, 'Pipeline', {
      synth: new pipelines.ShellStep('Synth', {
        input: pipelines.CodePipelineSource.gitHub('colifran/cdk-pipelines-demo', 'main'),
        commands: [
          'npm ci',
          'npm run build',
          'npx cdk synth',
        ],
      }),
      codeBuildDefaults: {
        logging: {
          cloudWatch: {
            logGroup,
          },
          s3: {
            bucket,
          },
        },
      },
    });

    pipeline.addStage(new AppStage(this, 'Beta'));

    const group = pipeline.addWave('Wave1');
    group.addStage(new AppStage(this, 'Prod1'));
    group.addStage(new AppStage(this, 'Prod2'));

    const group2 = pipeline.addWave('Wave2');
    group2.addStage(new AppStage(this, 'Prod3'));
    group2.addStage(new AppStage(this, 'Prod4'));
    group2.addStage(new AppStage(this, 'Prod5'));
    group2.addStage(new AppStage(this, 'Prod6'));
  }
}

class AppStage extends Stage {
  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);

    const stack1 = new Stack(this, 'Stack1');
    const queue1 = new sqs.Queue(stack1, 'Queue');

    const stack2 = new Stack(this, 'Stack2');
    new sqs.Queue(stack2, 'OtherQueue', {
      deadLetterQueue: {
        queue: queue1,
        maxReceiveCount: 5,
      },
    });
  }
}

const app = new App({
  postCliContext: {
    '@aws-cdk/core:newStyleStackSynthesis': '1',
    '@aws-cdk/aws-codepipeline:defaultPipelineTypeToV2': false,
    '@aws-cdk/pipelines:reduceStageRoleTrustScope': true,
  },
});

const stack = new PipelineStack(app, 'PipelineStack');
new integ.IntegTest(app, 'PipelineWithCustomStepStackOutputTest', {
  testCases: [stack],
});

app.synth();
