import fs from 'fs';
import path from 'path';
import { makeExecutable } from '../utils';
import { ISession } from '../../session/types';
import { buildContent, cleanBuiltFiles, watchContent } from './prepare';
import { getServerLogger } from './serverLogger';
import { ensureBuildFolderExists, exists, serverPath } from './utils';
import { Options } from './types';
import { deployContent } from './deploy';
import { MyUser } from '../../models';

export async function clean(session: ISession, opts: Options) {
  if (!exists(opts)) {
    session.log.debug(`web.clean: ${serverPath(opts)} not found.`);
    return;
  }
  session.log.debug(`web.clean: Removing ${serverPath(opts)}`);
  fs.rmdirSync(serverPath(opts), { recursive: true });
}

export async function clone(session: ISession, opts: Options) {
  session.log.info('🌎 Cloning Curvespace');
  const branch = opts.branch || 'main';
  if (branch !== 'main') {
    session.log.warn(`👷‍♀️ Warning, using a branch: ${branch}`);
  }
  await makeExecutable(
    `git clone --branch ${branch} git@github.com:curvenote/curvespace.git ${serverPath(opts)}`,
    session.log,
  )();
  // TODO: log out version!
  session.log.debug('Cleaning out any git information from build folder.');
  // TODO: udpate this when we are downloading a zip
  const p = serverPath(opts);
  // Remove all git-related things
  fs.rmdirSync(path.join(p, '.git'), { recursive: true });
  fs.rmdirSync(path.join(p, '.github'), { recursive: true });
  cleanBuiltFiles(session, opts, false);
}

export async function install(session: ISession, opts: Options) {
  session.log.info('⤵️  Installing libraries');
  if (!exists(opts)) {
    session.log.error('Curvespace is not cloned. Do you need to run: \n\ncurvenote web clone');
    return;
  }
  await makeExecutable(`cd ${serverPath(opts)}; npm install`, session.log)();
}

async function cloneCurvespace(session: ISession, opts: Options) {
  if (opts.force) {
    await clean(session, opts);
  }
  if (exists(opts)) {
    session.log.debug('Curvespace has been cloned, skipping install');
    return;
  }
  ensureBuildFolderExists(opts);
  await clone(session, opts);
  await install(session, opts);
}

function sparkles(session: ISession, name: string) {
  session.log.info(`\n\n\t✨✨✨  ${name}  ✨✨✨\n\n`);
}

export async function serve(session: ISession, opts: Options) {
  await cloneCurvespace(session, opts);
  sparkles(session, 'Starting Curvenote');
  const cache = await buildContent(session, opts);
  // Watch the files in the content folder and process them
  watchContent(cache);
  // Start the server and wait on it
  await makeExecutable(`cd ${serverPath(opts)}; npm run serve`, getServerLogger(session))();
}

export async function build(session: ISession, opts: Options) {
  await cloneCurvespace(session, opts);
  sparkles(session, 'Building Curvenote');
  // Build the files in the content folder and process them
  await buildContent(session, opts);
}

export async function deploy(session: ISession, opts: Omit<Options, 'clean'>) {
  if (session.isAnon) {
    session.log.error(
      '⚠️ You must be authenticated for this call. Use `curvenote token set [token]`',
    );
    return;
  }
  const me = await new MyUser(session).get();
  // Do a bit of prework to ensure that the domains exists in the config file
  const config = session.loadConfig();
  const domains = config?.web.domains;
  if (!domains || domains.length === 0) {
    session.log.error(
      `🧐 No domains specified, use config.site.domains: - ${me.data.username}.curve.space`,
    );
    return;
  }
  await cloneCurvespace(session, opts);
  sparkles(session, 'Deploying Curvenote');
  // Build the files in the content folder and process them
  const cache = await buildContent(session, { ...opts, clean: true });
  await deployContent(cache, domains);
}
