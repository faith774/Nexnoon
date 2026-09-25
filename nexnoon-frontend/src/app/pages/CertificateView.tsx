import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { BadgeCheck, Check, Copy, Download, Linkedin, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import BrandLoader from '@/app/components/BrandLoader';
import { btn } from '@/app/components/studio/ui';
import { apiClient } from '@/lib/api';

export interface CertificateData {
  certificateId: string;
  url: string;
  learnerName: string;
  classId: string;
  classTitle: string;
  courseTitle?: string;
  courseSlug?: string;
  language?: string;
  instructorName: string;
  completedAt?: string;
  issuedAt?: string;
  sessionsAttended: number;
  totalSessions: number;
  note?: string;
  valid?: boolean;
  viewerOwns?: boolean;
}

const longDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '';

export function CertificateSheet({ cert }: { cert: CertificateData }) {
  return (
    <div className="certificate-sheet relative mx-auto aspect-[1.414/1] w-full max-w-4xl overflow-hidden bg-[#fffdf9] p-[3.5%] text-[#14110e] shadow-[0_30px_80px_-30px_rgba(20,17,14,0.35)] print:max-w-none print:shadow-none">
      <div className="absolute inset-[2.2%] border border-[#c45c26]/50" aria-hidden />
      <div className="absolute inset-[3%] border border-[#e4dfd6]" aria-hidden />
      <div className="pointer-events-none absolute -right-[12%] -top-[20%] h-[70%] w-[45%] rounded-full bg-[#fbeee6] opacity-70 blur-3xl" aria-hidden />
      <div className="relative flex h-full flex-col items-center justify-between px-[6%] py-[4%] text-center">
        <div className="flex w-full items-center justify-between text-[clamp(8px,1.2vw,12px)] uppercase tracking-[0.28em] text-[#8a847a]">
          <span className="font-semibold text-[#14110e]">Nexnoon</span>
          <span>Certificate of completion</span>
        </div>

        <div className="flex flex-col items-center">
          <p className="text-[clamp(9px,1.3vw,13px)] uppercase tracking-[0.3em] text-[#8a847a]">This certifies that</p>
          <h1 className="mt-[2%] font-serif text-[clamp(26px,5.4vw,56px)] leading-[1.05] tracking-tight">{cert.learnerName}</h1>
          <div className="mx-auto mt-[2.5%] h-px w-24 bg-[#c45c26]" />
          <p className="mt-[2.5%] text-[clamp(10px,1.5vw,15px)] text-[#6b655c]">has successfully completed the live class</p>
          <h2 className="mt-[1.5%] max-w-[85%] font-serif text-[clamp(16px,2.8vw,30px)] leading-snug tracking-tight">{cert.classTitle}</h2>
          {cert.courseTitle || cert.language ? (
            <p className="mt-[1.2%] text-[clamp(9px,1.3vw,13px)] text-[#8a847a]">
              {[cert.courseTitle, cert.language].filter(Boolean).join(' · ')}
            </p>
          ) : null}
          {cert.totalSessions && cert.sessionsAttended ? (
            <p className="mt-[1.2%] text-[clamp(9px,1.2vw,12px)] text-[#8a847a]">
              {cert.sessionsAttended} of {cert.totalSessions} live sessions attended
            </p>
          ) : null}
        </div>

        <div className="grid w-full grid-cols-3 items-end gap-4 text-[clamp(8px,1.15vw,12px)]">
          <div className="text-left">
            <p className="font-serif text-[clamp(12px,1.9vw,19px)] italic text-[#14110e]">{cert.instructorName}</p>
            <div className="mt-1 h-px w-full max-w-[180px] bg-[#d5cfc4]" />
            <p className="mt-1 uppercase tracking-[0.18em] text-[#8a847a]">Instructor</p>
          </div>
          <div className="flex justify-center">
            <div className="flex h-[clamp(44px,8vw,84px)] w-[clamp(44px,8vw,84px)] flex-col items-center justify-center rounded-full border-2 border-[#c45c26] text-[#c45c26]">
              <BadgeCheck className="h-1/3 w-1/3" />
              <span className="mt-0.5 text-[clamp(5px,0.8vw,8px)] font-semibold uppercase tracking-[0.2em]">Verified</span>
            </div>
          </div>
          <div className="text-right">
            <p className="font-serif text-[clamp(12px,1.9vw,19px)] text-[#14110e]">{longDate(cert.issuedAt || cert.completedAt)}</p>
            <div className="ml-auto mt-1 h-px w-full max-w-[180px] bg-[#d5cfc4]" />
            <p className="mt-1 uppercase tracking-[0.18em] text-[#8a847a]">Date issued</p>
          </div>
        </div>

        <p className="text-[clamp(7px,0.95vw,10px)] tracking-wide text-[#8a847a]">
          Certificate ID {cert.certificateId} · Verify at {cert.url.replace(/^https?:\/\//, '')}
        </p>
      </div>
    </div>
  );
}

function linkedInUrl(cert: CertificateData) {
  const issued = new Date(cert.issuedAt || cert.completedAt || Date.now());
  const params = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: cert.classTitle,
    organizationName: 'Nexnoon',
    issueYear: String(issued.getFullYear()),
    issueMonth: String(issued.getMonth() + 1),
    certUrl: cert.url,
    certId: cert.certificateId,
  });
  return `https://www.linkedin.com/profile/add?${params.toString()}`;
}

export default function CertificateView() {
  const { certificateId = '' } = useParams();
  const [cert, setCert] = useState<CertificateData | null>(null);
  const [missing, setMissing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    apiClient
      .get(`/enrollments/certificates/verify/${encodeURIComponent(certificateId)}`)
      .then((res) => active && setCert(res.data.data))
      .catch(() => active && setMissing(true));
    return () => {
      active = false;
    };
  }, [certificateId]);

  useEffect(() => {
    if (cert) document.title = `${cert.learnerName} · ${cert.classTitle} · Nexnoon certificate`;
  }, [cert]);

  async function copyLink() {
    if (!cert) return;
    await navigator.clipboard.writeText(cert.url).catch(() => {});
    setCopied(true);
    toast.success('Verification link copied');
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (!cert && !missing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f4f0]">
        <BrandLoader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f4f0] text-[#14110e] print:bg-white">
      <style>{`@media print { @page { size: A4 landscape; margin: 0; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>
      <div className="print:hidden">
        <Header variant="light" />
      </div>
      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6 print:m-0 print:max-w-none print:p-0">
        {missing || !cert ? (
          <section className="mx-auto max-w-lg border border-[#e4dfd6] bg-white p-8 text-center">
            <ShieldAlert className="mx-auto h-10 w-10 text-rose-700" />
            <h1 className="mt-4 font-serif text-2xl tracking-tight">We couldn't verify this certificate</h1>
            <p className="mt-2 text-sm text-[#6b655c]">
              No completed Nexnoon class matches <span className="font-mono">{certificateId}</span>. Check the ID or ask the holder for their verification link.
            </p>
            <Link to="/" className={`${btn.primary} mt-6`}>Go to Nexnoon</Link>
          </section>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
              <div className="flex items-center gap-3 border border-emerald-200 bg-emerald-50/80 px-4 py-2.5 text-sm text-emerald-900">
                <BadgeCheck className="h-5 w-5 shrink-0 text-emerald-700" />
                <span>
                  <strong className="font-medium">Verified.</strong> Nexnoon confirms {cert.learnerName} completed this class on {longDate(cert.completedAt || cert.issuedAt)}.
                </span>
              </div>
              {cert.viewerOwns ? (
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={btn.accent} onClick={() => window.print()}>
                    <Download className="h-4 w-4" /> Download PDF
                  </button>
                  <button type="button" className={btn.secondary} onClick={() => void copyLink()}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy link
                  </button>
                  <a className={btn.secondary} href={linkedInUrl(cert)} target="_blank" rel="noopener noreferrer">
                    <Linkedin className="h-4 w-4" /> Add to LinkedIn
                  </a>
                </div>
              ) : null}
            </div>

            <CertificateSheet cert={cert} />

            {cert.viewerOwns ? (
              <p className="mt-4 text-center text-xs text-[#8a847a] print:hidden">
                Download PDF opens your browser's print window. Choose “Save as PDF” as the destination.
              </p>
            ) : null}

            <section className="mx-auto mt-10 grid max-w-4xl gap-6 border-t border-[#e4dfd6] pt-8 text-sm sm:grid-cols-3 print:hidden">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#8a847a]">Class</p>
                <Link to={`/class/${cert.classId}`} className="mt-1 block font-medium hover:text-[#c45c26]">{cert.classTitle}</Link>
                {cert.courseSlug ? (
                  <Link to={`/courses/${cert.courseSlug}`} className="text-xs text-[#6b655c] hover:text-[#c45c26]">Part of {cert.courseTitle}</Link>
                ) : null}
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#8a847a]">Taught by</p>
                <p className="mt-1 font-medium">{cert.instructorName}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#8a847a]">Certificate ID</p>
                <p className="mt-1 font-mono">{cert.certificateId}</p>
              </div>
              {cert.note ? <p className="text-[#6b655c] sm:col-span-3">{cert.note}</p> : null}
            </section>
          </>
        )}
      </main>
      <div className="print:hidden">
        <Footer />
      </div>
    </div>
  );
}
