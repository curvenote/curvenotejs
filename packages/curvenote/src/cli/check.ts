import { Command } from 'commander';
import { logCheckReport, runChecks } from '../check/runner.js';
import type { ISession } from '../session/types.js';
import { clirun } from './utils.js';
import { submissionRuleChecks } from '@curvenote/check-implementations';
import { build } from 'myst-cli';

async function exampleChecks(session: ISession) {
  await build(session, [], { all: true, checkLinks: true });
  const checks = [...submissionRuleChecks, ...(session.plugins?.checks ?? [])];
  const checkIds = checks.map(({ id }) => {
    return { id };
  });
  const report = await runChecks(session, checkIds, checks);
  logCheckReport(session, report);
}

export function makeCheckCLI(program: Command) {
  const command = new Command('check')
    .description('Run some example checks on your MyST project')
    .action(clirun(exampleChecks, { program }));
  return command;
}

export function addCheckCLI(program: Command) {
  program.addCommand(makeCheckCLI(program));
}
