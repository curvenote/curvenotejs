import type { ISession } from '../session/types.js';
import type {
  CreateCliCheckJobPostBody,
  CreateSubmissionBody,
  STATUS_ACTIONS,
  UpdateCliCheckJobPostBody,
  UpdateSubmissionBody,
} from '../utils/index.js';
import { getHeaders } from '../session/tokens.js';
import { tic } from 'myst-cli-utils';
import format from 'date-fns/format';
import type { JsonObject } from '@curvenote/blocks';
import type { JobResponse, NewCheckJobPayload, NewCheckJobResults } from './types.js';
import type { SubmissionDTO, WorkDTO } from '@curvenote/common';

type LogInfo = { id: string; versionId: string; dateCreated: string; versionDateCreated: string };

export function formatDate(date: string) {
  return format(new Date(date), 'dd MMM, yyyy HH:mm:ss');
}

export async function getFromUrl(session: ISession, url: string) {
  session.log.debug('Getting from', url);
  const headers = await getHeaders(session, (session as any).$tokens);

  const response = await session.fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  if (response.ok) {
    const json = (await response.json()) as any;
    return json;
  } else {
    throw new Error(
      `GET FAILED ${url}: ${response.status}\n\n${response.statusText}
      Please contact support@curvenote.com`,
    );
  }
}

export async function getFromJournals(session: ISession, pathname: string) {
  const url = `${session.JOURNALS_URL}${pathname}`;
  const resp = await getFromUrl(session, url);
  return resp;
}

export async function postToUrl(
  session: ISession,
  url: string,
  body: JsonObject,
  opts: { method?: 'POST' | 'PATCH' | 'PUT' } = {},
) {
  session.log.debug(`${opts?.method ?? 'POST'}ing to`, url);
  const method = opts?.method ?? 'POST';
  const headers = await getHeaders(session, (session as any).$tokens);
  return session.fetch(url, {
    method,
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

export async function postToJournals(
  session: ISession,
  pathname: string,
  body: JsonObject,
  opts: { method?: 'POST' | 'PATCH' } = {},
) {
  const url = `${session.JOURNALS_URL}${pathname}`;
  const resp = await postToUrl(session, url, body, opts);
  return resp;
}

export async function postNewWork(
  session: ISession,
  cdnKey: string,
  cdn: string,
  key: string,
): Promise<LogInfo> {
  const toc = tic();

  session.log.debug(
    `POST to ${session.JOURNALS_URL}works with cdnKey: ${cdnKey}, cdn: ${cdn}, key: ${key}...`,
  );
  const resp = await postToJournals(session, 'works', { cdn_key: cdnKey, cdn, key });
  session.log.debug(`${resp.status} ${resp.statusText}`);
  if (resp.ok) {
    const json = (await resp.json()) as WorkDTO;
    const { id, version_id, date_created } = json;
    if (!version_id) {
      throw new Error('Posting new work failed to create a version');
    }
    session.log.info(toc(`🚀 Created a new work in %s.`));
    session.log.debug(`CDN key: ${cdnKey}`);
    session.log.debug(`Work Id: ${id}`);
    session.log.debug(`Work Version Id: ${version_id}`);
    return {
      id: id,
      versionId: version_id,
      dateCreated: date_created,
      versionDateCreated: date_created,
    };
  } else {
    throw new Error('Posting new work failed');
  }
}

export async function postNewWorkVersion(
  session: ISession,
  workUrl: string,
  cdnKey: string,
  cdn: string,
): Promise<LogInfo> {
  const toc = tic();

  session.log.debug(`POST to ${workUrl}/versions with cdnKey: ${cdnKey} and cdn: ${cdn}...`);
  const resp = await postToUrl(session, `${workUrl}/versions`, { cdn_key: cdnKey, cdn });
  session.log.debug(`${resp.status} ${resp.statusText}`);

  if (resp.ok) {
    const json = (await resp.json()) as WorkDTO;
    const { id, version_id, date_created } = json;
    if (!version_id) {
      throw new Error('Updating work failed to create a version');
    }
    session.log.info(toc(`🚀 Created a new work version in %s.`));
    session.log.debug(`CDN key: ${cdnKey}`);
    session.log.debug(`Work Id: ${id}`);
    session.log.debug(`Work Version Id: ${version_id}`);
    return {
      id: id,
      versionId: version_id,
      dateCreated: date_created,
      versionDateCreated: date_created,
    };
  } else {
    throw new Error('Posting new version of the work failed');
  }
}

export async function postNewCliCheckJob(
  session: ISession,
  payload: NewCheckJobPayload,
  results: NewCheckJobResults,
) {
  const toc = tic();
  const body: CreateCliCheckJobPostBody = {
    job_type: 'CLI_CHECK',
    payload,
    results,
  };
  session.log.debug(`POST to ${session.JOURNALS_URL}jobs...`);
  const resp = await postToJournals(session, `jobs`, body);
  session.log.debug(`${resp.status} ${resp.statusText}`);
  if (resp.ok) {
    const json = (await resp.json()) as JobResponse;
    session.log.info(toc(`🎉 Posted a new job in %s.`));
    session.log.debug(`Job id: ${json.id}`);
    session.log.debug(`Job status: ${json.status}`);
    return json;
  } else {
    throw new Error('Job creation failed');
  }
}

export async function patchUpdateCliCheckJob(
  session: ISession,
  jobId: string,
  status: string,
  message: string,
  results: Record<string, any>,
) {
  const toc = tic();
  const body: UpdateCliCheckJobPostBody = {
    status,
    message,
    results,
  };
  session.log.debug(`PATCH to ${session.JOURNALS_URL}jobs...`);
  const resp = await postToJournals(session, `jobs/${jobId}`, body, { method: 'PATCH' });
  session.log.debug(`${resp.status} ${resp.statusText}`);
  if (resp.ok) {
    const json = (await resp.json()) as JobResponse;
    session.log.info(toc(`🎉 Updated a job in %s.`));
    session.log.debug(`Job id: ${json.id}`);
    session.log.debug(`Job status: ${json.status}`);
    return json;
  } else {
    throw new Error('Job update failed');
  }
}

export async function postNewSubmission(
  session: ISession,
  venue: string,
  collection_id: string,
  kind_id: string,
  work_version_id: string,
  draft: boolean,
  job_id: string,
): Promise<LogInfo> {
  const toc = tic();
  const submissionRequest: CreateSubmissionBody = {
    work_version_id,
    collection_id,
    kind_id,
    draft,
    job_id,
  };
  session.log.debug(`POST to ${session.JOURNALS_URL}sites/${venue}/submissions...`);
  const resp = await postToJournals(session, `sites/${venue}/submissions`, submissionRequest);
  session.log.debug(`${resp.status} ${resp.statusText}`);
  if (resp.ok) {
    const json = (await resp.json()) as SubmissionDTO;
    session.log.info(toc(`🚀 Submitted to venue "${venue}" in %s.`));
    session.log.debug(`Submission id: ${json.id}`);
    session.log.debug(`Submitted by: ${json.submitted_by.name ?? json.submitted_by.id}`);
    return {
      id: json.id,
      versionId: json.versions[0].id,
      dateCreated: json.date_created,
      versionDateCreated: json.versions[0].date_created,
    };
  } else {
    throw new Error('Creating new submission failed');
  }
}

export async function postUpdateSubmissionWorkVersion(
  session: ISession,
  venue: string,
  submissionUrl: string,
  work_version_id: string,
  job_id: string,
): Promise<LogInfo> {
  const toc = tic();
  const submissionRequest: UpdateSubmissionBody = { work_version_id, job_id };
  session.log.debug(`POST to ${submissionUrl}...`);
  const resp = await postToUrl(session, submissionUrl, submissionRequest);
  session.log.debug(`${resp.status} ${resp.statusText}`);
  if (resp.ok) {
    const json = (await resp.json()) as SubmissionDTO;
    session.log.info(toc(`🚀 Updated submission accepted by "${venue}" in %s.`));
    session.log.debug(`Submission id: ${json.id}`);
    session.log.debug(`Submitted by: ${json.submitted_by.name ?? json.submitted_by.id}`);
    return {
      id: json.id,
      // TODO: This sorting feels very fragile
      // The list is sorted in reverse date order at the moment
      versionId: json.versions[0].id,
      dateCreated: json.date_created,
      versionDateCreated: json.versions[0].date_created,
    };
  } else {
    throw new Error('Updating submission failed');
  }
}

export async function patchUpdateSubmissionStatus(
  session: ISession,
  venue: string,
  submissionUrl: string,
  action: STATUS_ACTIONS,
) {
  const toc = tic();
  session.log.debug(`GET to ${submissionUrl}...`);
  const submissionJson = await getFromUrl(session, submissionUrl);
  const updateUrl = submissionJson?.links?.[action];
  if (!updateUrl) {
    throw new Error(`Action "${action}" not available for submission`);
  }
  session.log.debug(`PUT to ${updateUrl}...`);
  const resp = await postToUrl(
    session,
    updateUrl,
    {}, // Currently takes no body
    { method: 'PUT' },
  );
  session.log.debug(`${resp.status} ${resp.statusText}`);
  if (resp.ok) {
    const json = (await resp.json()) as SubmissionDTO;
    session.log.info(
      toc(
        `🚀 Submission successfully ${action === 'publish' ? 'publishing to' : 'unpublishing from'} "${venue}" in %s.`,
      ),
    );
    session.log.debug(`Submission id: ${json.id}`);
    session.log.debug(
      `Submission version statuses: ${json.versions.map((v: { status: string }) => v.status)}`,
    );
  } else {
    throw new Error(`Submission failed to ${action}`);
  }
}

export function exitOnInvalidKeyOption(session: ISession, key: string) {
  session.log.debug(`Checking for valid key option: ${key}`);
  if (key.length < 8 || key.length > 128) {
    session.log.error(`⛔️ The key must be between 8 and 128 characters long.`);
    process.exit(1);
  }
}
