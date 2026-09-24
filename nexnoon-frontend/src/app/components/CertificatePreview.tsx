export function CertificatePreview({
  title = 'Course title',
  instructor = 'Nexnoon Expert',
  information = 'The instructor has not provided certificate information yet.',
}: {
  title?: string;
  instructor?: string;
  information?: string;
}) {
  return (
    <div className="border border-[#e4dfd6] bg-white overflow-hidden">
      <div className="grid lg:grid-cols-2">
        <div className="p-6 sm:p-8 border-b lg:border-b-0 lg:border-r border-[#eee9e0]">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[#6b655c] mb-2">Certificate</p>
          <h2 className="font-serif text-xl text-[#14110e] mb-2 tracking-tight">Earn your certificate</h2>
          <p className="text-sm text-[#3d3933] leading-relaxed mb-4">{information}</p>
          <p className="text-xs text-[#8a847a] leading-relaxed">
            Issued by the lead instructor when the learner completes the class requirements.
          </p>
        </div>

        <div className="p-6 sm:p-8 bg-[#faf8f5] flex items-center justify-center">
          <div className="w-full max-w-sm bg-white border border-[#e4dfd6] p-6 text-center shadow-[0_12px_40px_rgba(20,17,14,0.06)]">
            <div className="border-b border-[#eee9e0] pb-4 mb-4">
              <div className="mx-auto mb-2 h-10 w-10 bg-[#14110e] text-white text-sm font-semibold flex items-center justify-center">
                N
              </div>
              <p className="font-serif text-lg text-[#14110e]">Nexnoon</p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-[#8a847a] mt-1">
                Certificate of Completion
              </p>
            </div>
            <p className="text-[11px] text-[#6b655c]">This certifies that</p>
            <p className="font-serif text-lg text-[#14110e] mt-1 mb-1">Your Name</p>
            <p className="text-[11px] text-[#6b655c] mb-1">has completed</p>
            <p className="text-sm font-medium text-[#3d3933] leading-snug">{title}</p>
            <div className="mt-5 pt-4 border-t border-[#eee9e0] flex items-end justify-between text-left">
              <div>
                <div className="w-16 h-px bg-[#14110e] mb-1" />
                <p className="text-[11px] text-[#3d3933]">{instructor}</p>
                <p className="text-[10px] text-[#8a847a]">Lead instructor</p>
              </div>
              <p className="text-[10px] text-[#8a847a] uppercase tracking-wider">Preview</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
