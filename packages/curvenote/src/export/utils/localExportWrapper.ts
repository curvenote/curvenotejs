import fs from 'fs';
import { createTempFolder } from 'myst-cli';
import type { LinkTransformer } from 'myst-transforms';
import { join } from 'path';
import { OxaTransformer } from '../../transforms';
import type { ISession } from '../../session/types';
import { oxaLinkToMarkdown } from '../markdown';

export const localExportWrapper =
  (
    exportLocalArticle: (
      session: ISession,
      path: string,
      opts: { filename: string } & Record<string, any>,
      templateOptions?: Record<string, any>,
      extraLinkTransformers?: LinkTransformer[],
    ) => Promise<void>,
    defaultOptions: Record<string, any>,
  ) =>
  async (
    session: ISession,
    path: string,
    filename: string,
    opts: Record<string, any>,
    templateOptions?: Record<string, any>,
  ) => {
    let localPath: string;
    if (fs.existsSync(path)) {
      session.log.info(`🔍 Found local file to export: ${path}`);
      localPath = path;
    } else {
      session.log.info(`🌍 Downloading: ${path}`);
      const localFilename = 'output.md';
      const localFolder = createTempFolder(session);
      localPath = join(localFolder, localFilename);
      await oxaLinkToMarkdown(session, path, localFilename, { path: localFolder });
    }
    await exportLocalArticle(
      session,
      localPath,
      { ...defaultOptions, filename, ...opts },
      templateOptions,
      [new OxaTransformer(session)],
    );
  };
