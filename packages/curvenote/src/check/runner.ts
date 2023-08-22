import path from 'node:path';
import chalk from 'chalk';
import {
  KNOWN_IMAGE_EXTENSIONS,
  createTempFolder,
  findCurrentProjectAndLoad,
  getFileContent,
  loadProjectFromDisk,
} from 'myst-cli';
import { incrementOptions } from 'simple-validators';
import type { ISession } from '../session/types.js';
import { CheckStatus } from './types.js';
import type { Check, CheckDefinition, CheckInterface, CheckReport, CheckResult } from './types.js';
import { validateCheck } from './validators.js';

export async function runChecks(
  session: ISession,
  file: string,
  checks: Check[],
  checkDefinitions: CheckInterface[],
): Promise<CheckReport> {
  const opts = { property: 'checks', messages: {} };
  if (!['.ipynb', '.md', '.tex'].includes(path.extname(file))) {
    throw new Error('Currently checks are only supported on .md, .ipynb, and .tex files');
  }
  const projectPath = await findCurrentProjectAndLoad(session, path.dirname(file));
  if (projectPath) {
    await loadProjectFromDisk(session, projectPath);
  }
  await getFileContent(session, [file], createTempFolder(session), {
    projectPath,
    useExistingImages: true,
    imageExtensions: KNOWN_IMAGE_EXTENSIONS,
    simplifyFigures: false,
  });
  const completedChecks = (
    await Promise.all(
      checks.map(async (check, index) => {
        const validCheck = validateCheck(
          session,
          check,
          checkDefinitions,
          incrementOptions(`${index}`, opts),
        );
        if (!validCheck) return undefined;
        const checkDefinition = checkDefinitions.find((def) => check.id === def.id);
        const result = await checkDefinition?.validate(session, file, validCheck);
        return result ? { ...checkDefinition, ...result } : undefined;
      }),
    )
  ).filter((check): check is CheckDefinition & CheckResult => !!check);
  let finalStatus = CheckStatus.pass;
  const checkCategories: Record<string, CheckReport['results'][0]> = {};
  completedChecks.forEach((check) => {
    const { category, status } = check;
    if (!checkCategories[category]) {
      checkCategories[category] = {
        category,
        status,
        checks: [check],
      };
    } else {
      checkCategories[category].checks.push(check);
    }
    if (status !== CheckStatus.pass) {
      checkCategories[category].status = CheckStatus.fail;
      finalStatus = CheckStatus.fail;
    }
  });
  return { status: finalStatus, results: Object.values(checkCategories) };
}

export function logCheckReport(session: ISession, report: CheckReport) {
  const checkFail = (msg: string, icon?: boolean, prefix?: string) => {
    return chalk.red(`${prefix ?? ''}${icon ? '❌' : ''} ${msg}`);
  };
  const checkError = (msg: string, icon?: boolean, prefix?: string) => {
    return chalk.yellow(`${prefix ?? ''}${icon ? '⚠️' : ''}  ${msg}`);
  };
  const checkPass = (msg: string, icon?: boolean, prefix?: string) => {
    return chalk.green(`${prefix ?? ''}${icon ? '✅' : ''} ${msg}`);
  };
  if (report.status === CheckStatus.pass) {
    session.log.info(chalk.bold(checkPass('All checks passed:')));
  } else {
    session.log.error(chalk.bold(checkFail('Checks did not all pass:')));
  }
  report.results.forEach((result) => {
    const { status, category, checks } = result;
    if (status === CheckStatus.pass) {
      session.log.info(
        checkPass(
          `${chalk.bold(category)} (${checks.length}/${checks.length} tests passed)`,
          true,
          '  ',
        ),
      );
    } else {
      session.log.error(
        checkFail(
          `${chalk.bold(category)} (${checks.filter((c) => c.status === CheckStatus.pass).length}/${
            checks.length
          } tests passed)`,
          false,
          '    ',
        ),
      );
    }
    checks.forEach((check) => {
      const { message } = check;
      const messageWithTitle = `${chalk.bold(check.title)}: ${message}`;
      if (status === CheckStatus.pass) {
        session.log.debug(checkPass(messageWithTitle, true, '        '));
      } else if (check.status === CheckStatus.pass) {
        session.log.info(checkPass(messageWithTitle, true, '        '));
      } else if (check.status === CheckStatus.error) {
        session.log.error(checkError(messageWithTitle, true, '        '));
      } else {
        session.log.error(checkFail(messageWithTitle, true, '        '));
      }
    });
  });
}
