import { Award, CalendarCheck, ClipboardCheck, Info } from 'lucide-react';

const NO_CERTIFICATE = /\b(does not|doesn[’']t|will not|won[’']t|no)\b[^.]*\bcertificates?\b/i;

const steps = [
  { icon: CalendarCheck, label: 'Attend the live sessions' },
  { icon: ClipboardCheck, label: 'Complete the class requirements' },
  { icon: Award, label: 'Your lead instructor issues the certificate' },
];

export function CertificatePreview({
  title = 'Course title',
  instructor = 'Nexnoon Expert',
  information,
}: {
  title?: string;
  instructor?: string;
  information?: string;
}) {
  const note = information?.trim();
  const issues = !note || !NO_CERTIFICATE.test(note);

  return (
    <div className="overflow-hidden rounded-3xl border border-[#e4dfd6] bg-white">
      <div className="grid lg:grid-cols-[1fr_1.15fr]">
        <div className="flex flex-col p-6 sm:p-8">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a847a]">Certificate</p>
          <h2 className="font-serif text-2xl tracking-tight text-[#14110e]">
            {issues ? 'Earn your certificate' : 'No certificate for this class'}
          </h2>

          {issues ? (
            <>
              {note ? <p className="mt-3 text-sm leading-relaxed text-[#3d3933]">{note}</p> : null}
              <ol className="mt-6 space-y-3">
                {steps.map((s, i) => (
                  <li key={s.label} className="flex items-center gap-3 text-sm text-[#2b2722]">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f3f1ec] text-[#14110e]">
                      <s.icon className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="mr-1.5 text-[#a39d93]">{i + 1}.</span>
                      {s.label}
                    </span>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <div className="mt-4 flex gap-3 rounded-2xl bg-[#f7f5f1] p-4 text-sm leading-relaxed text-[#3d3933]">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#8a847a]" />
              <p>{note}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center border-t border-[#eee9e0] bg-[#f7f5f1] p-6 sm:p-8 lg:border-l lg:border-t-0">
          <div className="relative w-full max-w-md">
            <div
              className={`aspect-[1.414/1] w-full rounded-md bg-white p-2.5 shadow-[0_20px_50px_-24px_rgba(20,17,14,0.35)] ${
                issues ? '' : 'opacity-90'
              }`}
            >
              <div className="flex h-full flex-col items-center justify-between rounded-sm border border-[#d9d3c8] px-5 py-4 text-center outline outline-1 outline-offset-[-6px] outline-[#eee9e0]">
                <div>
                  <p className="text-[13px] font-bold tracking-tight text-[#14110e]">
                    Nexnoon<span className="text-[#889dd1]">.</span>
                  </p>
                  <p className="mt-1 text-[8px] font-semibold uppercase tracking-[0.3em] text-[#8a847a]">
                    Certificate of completion
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="text-[9px] text-[#8a847a]">This certifies that</p>
                  <p className="mt-0.5 font-serif text-xl italic text-[#14110e] sm:text-2xl">Your Name</p>
                  <div className="mx-auto mt-1 h-px w-32 bg-[#e4dfd6]" />
                  <p className="mt-1.5 text-[9px] text-[#8a847a]">has successfully completed</p>
                  <p className="mt-0.5 line-clamp-2 px-4 font-serif text-sm leading-snug text-[#2b2722]">{title}</p>
                </div>

                <div className="flex w-full items-end justify-between">
                  <div className="text-left">
                    <p className="font-serif text-[11px] italic text-[#3d3933]">{instructor}</p>
                    <div className="my-0.5 h-px w-20 bg-[#14110e]/60" />
                    <p className="text-[8px] uppercase tracking-[0.14em] text-[#8a847a]">Lead instructor</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#c45c26]/40 bg-[#c45c26]/[0.06]">
                    <Award className="h-5 w-5 text-[#c45c26]" />
                  </div>
                </div>
              </div>
            </div>
            <span className="absolute -top-2.5 right-3 rounded-full bg-[#14110e] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white">
              {issues ? 'Preview' : 'Sample design'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
