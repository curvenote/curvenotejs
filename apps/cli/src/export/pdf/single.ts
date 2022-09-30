import path from 'path';
import { ExportFormats } from 'myst-frontmatter';
import type { ISession } from '../../session/types';
import { createTempFolder, findProjectAndLoad } from '../../utils';
import { collectTexExportOptions, runTexExport } from '../tex/single';
import type { TexExportOptions } from '../tex/types';
import type { ExportWithOutput } from '../types';
import { resolveAndLogErrors } from '../utils/resolveAndLogErrors';
import { createPdfGivenTexExport } from './create';
import { cleanOutput } from '../utils/cleanOutput';

export function texExportOptionsFromPdf(
  session: ISession,
  pdfExp: ExportWithOutput,
  keepTex?: boolean,
  clean?: boolean,
) {
  const basename = path.basename(pdfExp.output, path.extname(pdfExp.output));
  const outputTexFile = `${basename}.tex`;
  let output: string;
  if (keepTex) {
    const texOutputFolder = path.join(path.dirname(pdfExp.output), `${basename}_pdf_tex`);
    if (clean) cleanOutput(session, texOutputFolder);
    output = path.join(texOutputFolder, outputTexFile);
  } else {
    output = path.join(createTempFolder(), outputTexFile);
  }
  return { ...pdfExp, format: ExportFormats.tex, output };
}

export async function localArticleToPdf(session: ISession, file: string, opts: TexExportOptions) {
  const projectPath = await findProjectAndLoad(session, path.dirname(file));
  const pdfExportOptionsList = await collectTexExportOptions(
    session,
    file,
    'pdf',
    [ExportFormats.pdf, ExportFormats.pdftex],
    projectPath,
    opts,
  );
  await resolveAndLogErrors(
    session,
    pdfExportOptionsList
      .map(async (exportOptions) => {
        const { format, output } = exportOptions;
        const keepTexAndLogs = format === ExportFormats.pdftex;
        const texExportOptions = texExportOptionsFromPdf(
          session,
          exportOptions,
          keepTexAndLogs,
          opts.clean,
        );
        await runTexExport(
          session,
          file,
          texExportOptions,
          opts.templatePath,
          projectPath,
          opts.clean,
        );
        await createPdfGivenTexExport(
          session,
          texExportOptions,
          output,
          opts.templatePath,
          keepTexAndLogs,
          opts.clean,
        );
      })
      .map((p) => p.catch((e) => e)),
  );
}
