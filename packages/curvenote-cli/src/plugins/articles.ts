import type { DirectiveSpec, GenericNode } from 'myst-common';

export const articlesDirective: DirectiveSpec = {
  name: 'cn:articles',
  doc: 'A listing directive that can be used to show a list of articles from a specific venue, collection or kind.',
  arg: {
    type: 'myst',
    doc: 'The title of the listing.',
  },
  body: {
    type: 'myst',
    doc: 'Descriptive content to be displayed along with the listing.',
  },
  options: {
    venue: {
      type: String,
      doc: 'The venue to list articles from.',
      required: true,
    },
    collection: {
      type: String,
      doc: 'The collection to list articles from.',
      required: false,
    },
    status: {
      type: String,
      doc: 'The status of articles to list (published | in-review).',
      required: false,
    },
    submission_kind: {
      type: String,
      doc: 'The kind of articles to list.',
      required: false,
    },
    layout: {
      type: String,
      doc: 'The layout of the of articles (list | cards).',
      required: false,
    },
    wide: {
      type: Boolean,
      doc: 'If set, the listing will be wide.',
      required: false,
    },
    limit: {
      type: Number,
      doc: 'The maximum number of articles to list.',
      required: false,
    },
    pagination: {
      type: String,
      doc: 'If `limit` is set, this gives a hint to the renderer on how to handle pagination (more | all | infinite).',
      required: false,
    },
  },
  validate(data, vfile) {
    if (!data.options?.venue) {
      vfile.message('A venue must be supplied.');
    }
    if (
      data.options?.status &&
      (typeof data.options.status !== 'string' ||
        (typeof data.options.status === 'string' &&
          !['published', 'in-review'].includes(data.options.status)))
    ) {
      vfile.message('Invalid status supplied.');
    }

    // TODO lookup API and validate venue, collection, kind exist?
    // TODO how to validate against the correct API? dev/staging/prod?

    return data;
  },
  run(data) {
    return [
      {
        type: 'cn:articles',
        title: data.arg,
        description: data.body,
        ...data.options,
        display: data.options?.display ?? 'list',
        pagination: data.options?.pagination ?? 'more',
      },
    ] as GenericNode[];
  },
};
