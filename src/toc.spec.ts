import mock from 'mock-fs';
import { projectFromPath } from './toc';

afterEach(() => mock.restore());

describe('site section generation', () => {
  it('empty', async () => {
    mock({});
    expect(() => projectFromPath('.')).toThrow();
  });
  it('invalid index', async () => {
    mock({ 'readme.md': '' });
    expect(() => projectFromPath('.', 'index.md')).toThrow();
  });
  it('readme.md only', async () => {
    mock({ 'readme.md': '' });
    expect(projectFromPath('.')).toEqual({
      file: 'readme.md',
      path: '.',
      title: 'readme',
      pages: [],
    });
  });
  it('README.md only', async () => {
    mock({ 'README.md': '' });
    expect(projectFromPath('.')).toEqual({
      file: 'README.md',
      path: '.',
      title: 'readme',
      pages: [],
    });
  });
  it('index.md only', async () => {
    mock({ 'index.md': '' });
    expect(projectFromPath('.', 'index.md')).toEqual({
      file: 'index.md',
      path: '.',
      title: 'index',
      pages: [],
    });
  });
  it('folder/subfolder/index.md only', async () => {
    mock({ 'folder/subfolder/index.md': '' });
    expect(projectFromPath('.', 'folder/subfolder/index.md')).toEqual({
      file: 'folder/subfolder/index.md',
      path: '.',
      title: 'index',
      pages: [],
    });
  });
  it('flat folder', async () => {
    mock({ 'readme.md': '', 'page.md': '', 'notebook.ipynb': '' });
    expect(projectFromPath('.')).toEqual({
      file: 'readme.md',
      path: '.',
      title: 'readme',
      pages: [
        {
          file: 'notebook.ipynb',
          slug: 'notebook',
          title: 'notebook',
          level: 1,
        },
        {
          file: 'page.md',
          slug: 'page',
          title: 'page',
          level: 1,
        },
      ],
    });
  });
  it('single folder', async () => {
    mock({ 'readme.md': '', folder: { 'page.md': '', 'notebook.ipynb': '' } });
    expect(projectFromPath('.')).toEqual({
      file: 'readme.md',
      path: '.',
      title: 'readme',
      pages: [
        {
          title: 'folder',
          level: 1,
        },
        {
          file: 'folder/notebook.ipynb',
          slug: 'notebook',
          title: 'notebook',
          level: 2,
        },
        {
          file: 'folder/page.md',
          slug: 'page',
          title: 'page',
          level: 2,
        },
      ],
    });
  });
  it('nested folders', async () => {
    mock({ 'readme.md': '', 'folder1/folder2/folder3': { 'page.md': '', 'notebook.ipynb': '' } });
    expect(projectFromPath('.')).toEqual({
      file: 'readme.md',
      path: '.',
      title: 'readme',
      pages: [
        {
          title: 'folder1',
          level: 1,
        },
        {
          title: 'folder2',
          level: 2,
        },
        {
          title: 'folder3',
          level: 3,
        },
        {
          file: 'folder1/folder2/folder3/notebook.ipynb',
          slug: 'notebook',
          title: 'notebook',
          level: 4,
        },
        {
          file: 'folder1/folder2/folder3/page.md',
          slug: 'page',
          title: 'page',
          level: 4,
        },
      ],
    });
  });
  it('specify index & folder', async () => {
    mock({
      'ignore.md': '',
      folder1: {
        'page1.md': '',
        folder2: {
          'readme.md': '',
          'page2.md': '',
          folder3: {
            'page3.md': '',
          },
        },
      },
    });
    expect(projectFromPath('folder1', 'folder1/folder2/readme.md')).toEqual({
      file: 'folder1/folder2/readme.md',
      path: 'folder1',
      title: 'readme',
      pages: [
        {
          title: 'folder2',
          level: 1,
        },
        {
          title: 'folder3',
          level: 2,
        },
        {
          file: 'folder1/folder2/folder3/page3.md',
          slug: 'page3',
          title: 'page3',
          level: 3,
        },
        {
          file: 'folder1/folder2/page2.md',
          slug: 'page2',
          title: 'page2',
          level: 2,
        },
        {
          file: 'folder1/page1.md',
          slug: 'page1',
          title: 'page1',
          level: 1,
        },
      ],
    });
  });
});