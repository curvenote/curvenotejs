import type { Block, Project } from '@curvenote/blocks';
import { oxaLink } from '@curvenote/blocks';
import { affiliations, downloadAndSaveImage, selectors } from 'myst-cli';
import type { Contributor, PageFrontmatter, ProjectFrontmatter } from 'myst-frontmatter';
import {
  PAGE_FRONTMATTER_KEYS,
  PROJECT_FRONTMATTER_KEYS,
  validatePageFrontmatterKeys,
  validateProjectFrontmatterKeys,
} from 'myst-frontmatter';
import type { ValidationOptions } from 'simple-validators';
import { filterKeys } from 'simple-validators';
import { dirname, join } from 'node:path';
import type { ISession } from '../session/index.js';
import { THUMBNAILS_FOLDER } from '../utils/index.js';

export function saveAffiliations(session: ISession, project: Project) {
  session.store.dispatch(
    affiliations.actions.receive({
      affiliations: project.affiliations || [],
    }),
  );
}

function resolveAffiliations(session: ISession, author: Contributor): Contributor {
  const { affiliations: authorAffiliations, ...rest } = author;
  if (!authorAffiliations) return { ...rest };
  const state = session.store.getState();
  const resolvedAffiliations = authorAffiliations
    .map((id) => selectors.selectAffiliation(state, id))
    .filter((text): text is string => typeof text === 'string');
  return { affiliations: resolvedAffiliations, ...rest };
}

export function projectFrontmatterFromDTO(
  session: ISession,
  project: Project,
  opts?: Partial<ValidationOptions>,
): ProjectFrontmatter {
  const apiFrontmatter = filterKeys(project, PROJECT_FRONTMATTER_KEYS) as ProjectFrontmatter;
  if (apiFrontmatter.authors) {
    apiFrontmatter.authors = apiFrontmatter.authors.map((author: Contributor) => {
      const resolvedAuthor = resolveAffiliations(session, author);
      delete resolvedAuthor.id;
      return resolvedAuthor;
    });
  }
  if (project.licenses) {
    // This will get validated below
    apiFrontmatter.license = project.licenses as any;
  }
  const frontmatter = validateProjectFrontmatterKeys(apiFrontmatter, {
    property: 'project',
    suppressErrors: true,
    suppressWarnings: true,
    messages: {},
    ...opts,
  });
  delete frontmatter.affiliations;
  return frontmatter;
}

export async function pageFrontmatterFromDTOAndThumbnail(
  session: ISession,
  filename: string,
  block: Block,
  date?: string | Date,
  opts?: Partial<ValidationOptions>,
): Promise<PageFrontmatter> {
  const apiFrontmatter = pageFrontmatterFromDTO(session, block, date, opts);
  if (block.links.thumbnail) {
    const result = await downloadAndSaveImage(
      session,
      block.links.thumbnail,
      block.name || block.id.block,
      join(dirname(filename), THUMBNAILS_FOLDER),
    );
    if (result) {
      apiFrontmatter.thumbnail = join(THUMBNAILS_FOLDER, result);
    }
  }
  return apiFrontmatter;
}

export function pageFrontmatterFromDTO(
  session: ISession,
  block: Block,
  date?: string | Date,
  opts?: Partial<ValidationOptions>,
): PageFrontmatter {
  const apiFrontmatter = filterKeys(block, PAGE_FRONTMATTER_KEYS) as PageFrontmatter;
  if (apiFrontmatter.authors) {
    apiFrontmatter.authors = apiFrontmatter.authors.map((author: Contributor) => {
      const resolvedAuthor = resolveAffiliations(session, author);
      delete resolvedAuthor.id;
      return resolvedAuthor;
    }) as any;
  }
  if (block.licenses) {
    apiFrontmatter.license = block.licenses as any;
  }
  // TODO: Date needs to be in block frontmatter
  if (block.date_modified) {
    apiFrontmatter.date = (date || block.date_modified) as any;
  }
  apiFrontmatter.oxa = oxaLink('', block.id) as any;
  const frontmatter = validatePageFrontmatterKeys(apiFrontmatter, {
    property: 'page',
    suppressErrors: true,
    suppressWarnings: true,
    messages: {},
    ...opts,
  });

  // in curvenote the article block tags are currently used to store the keywords
  if (frontmatter.tags) {
    frontmatter.keywords = frontmatter.tags?.map((t: any) => t);
  }
  delete frontmatter.affiliations;
  return frontmatter;
}
