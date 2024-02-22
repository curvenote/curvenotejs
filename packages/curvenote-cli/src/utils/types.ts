export type FromTo = {
  from: string;
  to: string;
};

export type FileInfo = {
  from: string;
  to: string;
  md5: string;
  size: number;
  contentType: string;
};

export type FileUpload = FileInfo & {
  bucket: string;
  signedUrl: string;
};

export interface WorkBody {
  key: string;
  cdn: string;
}

export interface CreateSubmissionBody {
  work_version_id: string;
  kind: string;
  draft: boolean;
  job_id: string;
  key?: string;
}

export interface UpdateSubmissionBody {
  work_version_id: string;
  job_id: string;
}

export interface CreateCliCheckJobPostBody {
  job_type: 'CLI_CHECK';
  payload: Record<string, any>;
  results: Record<string, any>;
}

export interface UpdateCliCheckJobPostBody {
  status: string;
  message: string;
  results: Record<string, any>;
}