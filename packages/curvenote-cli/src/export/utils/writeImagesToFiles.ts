import fs from 'node:fs';
import path from 'node:path';
import mime from 'mime-types';
import type { Blocks } from '@curvenote/blocks';
import type { Version } from '../../models.js';
import { Block } from '../../models.js';
import type { ISession } from '../../session/types.js';
import { getImageSrc } from './getImageSrc.js';
import type { ArticleState } from './walkArticle.js';

function contentTypeToExt(contentType: string): string {
  switch (contentType) {
    case 'image/jpg': // non-standard
      return 'jpg';
    default: {
      const ext = mime.extension(contentType);
      if (ext) return ext;
      throw new Error(`ContentType: "${contentType}" is not recognized as an extension.`);
    }
  }
}

function makeUniqueFilename(
  basePath: string,
  block: Block,
  content_type: string,
  version: Version<Blocks.Image | Blocks.Output>,
  taken: Set<string>,
  simple: boolean,
): string {
  const ext = contentTypeToExt(content_type);
  const filenames = [
    block.data.name,
    'file_name' in version.data ? version.data.file_name : '', // Output doesn't have a filename
    `${version.id.project}-${version.id.block}-v${version.id.version}`,
  ];
  if (simple) {
    // remove the first two options
    filenames.splice(0, 2);
  }
  const unique = filenames
    .map((filename) => {
      if (!filename) return '';
      let name = filename;
      if (!name.endsWith(ext)) name += `.${ext}`;
      const test = path.join(basePath, name);
      if (taken.has(test)) return '';
      return test;
    })
    .filter((n) => !!n);
  // return the first unique
  return unique[0];
}

type Options = {
  basePath: string;
  buildPath?: string;
  simple?: boolean;
};

export async function writeImagesToFiles(
  session: ISession,
  images: ArticleState['images'],
  options: Options,
) {
  const { basePath, buildPath, simple = false } = options;
  const takenFilenames: Set<string> = new Set();
  const filenames: Record<string, string> = {};
  await Promise.all(
    Object.entries(images).map(async ([key, image]) => {
      const [block] = await Promise.all([new Block(image.session, image.id).get(), image.get()]);
      const { src, content_type } = getImageSrc(image);
      if (!src || !content_type) return;
      const response = await session.fetch(src);
      const buffer = await response.buffer();
      const referencableFilename = makeUniqueFilename(
        basePath,
        block,
        content_type,
        image,
        takenFilenames,
        simple,
      );
      const filename = path.join(buildPath ?? '', referencableFilename);
      if (!fs.existsSync(filename)) fs.mkdirSync(path.dirname(filename), { recursive: true });
      session.log.debug(`Writing ${filename}`);
      fs.writeFileSync(filename, buffer);
      filenames[key] = referencableFilename;
      takenFilenames.add(referencableFilename);
    }),
  );

  return filenames;
}
